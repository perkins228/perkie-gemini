"""Firestore-based rate limiting with atomic transactions"""
from google.cloud import firestore
from datetime import datetime, timedelta
import logging
from typing import Optional
from src.config import settings
from src.models.schemas import QuotaStatus

logger = logging.getLogger(__name__)


class RateLimiter:
    """Three-tier rate limiting with Firestore"""

    def __init__(self):
        self.db = firestore.Client(project=settings.project_id)
        self.daily_limit = settings.rate_limit_daily
        self.burst_limit = settings.rate_limit_burst
        logger.info("Initialized Firestore rate limiter")

    def _get_reset_date(self) -> datetime:
        """Get tomorrow at midnight UTC"""
        tomorrow = datetime.utcnow() + timedelta(days=1)
        return tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

    async def check_rate_limit(
        self,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> QuotaStatus:
        """
        Check rate limit without consuming quota

        Priority: customer > session > IP
        """
        # Determine which quota to check
        if customer_id:
            doc_ref = self.db.collection('rate_limits').document(f'customer_{customer_id}')
            limit = self.daily_limit
        elif session_id:
            doc_ref = self.db.collection('rate_limits').document(f'session_{session_id}')
            limit = self.burst_limit
        else:
            doc_ref = self.db.collection('rate_limits').document(f'ip_{ip_address}')
            limit = self.daily_limit

        # Get current count
        doc = doc_ref.get()

        if not doc.exists:
            # First use
            return QuotaStatus(
                allowed=True,
                remaining=limit,
                limit=limit,
                reset_time=self._get_reset_date().isoformat()
            )

        data = doc.to_dict()
        current_count = data.get('count', 0)
        reset_date = data.get('reset_date')

        # Check if quota needs reset
        if reset_date < self._get_reset_date():
            return QuotaStatus(
                allowed=True,
                remaining=limit,
                limit=limit,
                reset_time=self._get_reset_date().isoformat()
            )

        # Check if limit exceeded
        if current_count >= limit:
            return QuotaStatus(
                allowed=False,
                remaining=0,
                limit=limit,
                reset_time=reset_date.isoformat()
            )

        return QuotaStatus(
            allowed=True,
            remaining=limit - current_count,
            limit=limit,
            reset_time=reset_date.isoformat()
        )

    async def consume_quota(
        self,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        style: Optional[str] = None
    ) -> QuotaStatus:
        """
        Atomically consume quota using Firestore transaction

        This prevents race conditions where multiple concurrent requests
        could exceed the limit by checking quota simultaneously
        """
        # Determine which quota to consume
        if customer_id:
            doc_ref = self.db.collection('rate_limits').document(f'customer_{customer_id}')
            limit = self.daily_limit
        elif session_id:
            doc_ref = self.db.collection('rate_limits').document(f'session_{session_id}')
            limit = self.burst_limit
        else:
            doc_ref = self.db.collection('rate_limits').document(f'ip_{ip_address}')
            limit = self.daily_limit

        # Atomic transaction
        @firestore.transactional
        def increment_count(transaction, doc_ref):
            snapshot = doc_ref.get(transaction=transaction)

            if not snapshot.exists:
                # First use - initialize counter
                transaction.set(doc_ref, {
                    'count': 1,
                    'reset_date': self._get_reset_date(),
                    'last_used': firestore.SERVER_TIMESTAMP,
                    'style': style
                })
                return QuotaStatus(
                    allowed=True,
                    remaining=limit - 1,
                    limit=limit,
                    reset_time=self._get_reset_date().isoformat()
                )

            data = snapshot.to_dict()
            current_count = data.get('count', 0)
            reset_date = data.get('reset_date')

            # Check if quota needs reset (new day)
            if reset_date < self._get_reset_date():
                transaction.update(doc_ref, {
                    'count': 1,
                    'reset_date': self._get_reset_date(),
                    'last_used': firestore.SERVER_TIMESTAMP,
                    'style': style
                })
                return QuotaStatus(
                    allowed=True,
                    remaining=limit - 1,
                    limit=limit,
                    reset_time=self._get_reset_date().isoformat()
                )

            # Increment count
            new_count = current_count + 1
            transaction.update(doc_ref, {
                'count': new_count,
                'last_used': firestore.SERVER_TIMESTAMP,
                'style': style
            })

            return QuotaStatus(
                allowed=True,
                remaining=max(0, limit - new_count),
                limit=limit,
                reset_time=reset_date.isoformat()
            )

        # Execute transaction
        transaction = self.db.transaction()
        return increment_count(transaction, doc_ref)

    async def consume_batch_quota(
        self,
        count: int,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> QuotaStatus:
        """
        Atomically consume multiple quota (for batch generation)

        Args:
            count: Number of quota to consume (usually 3 for all styles)
            customer_id: Customer ID
            session_id: Session ID
            ip_address: IP address

        Returns:
            QuotaStatus after consuming quota

        Raises:
            HTTPException: If insufficient quota available
        """
        # Determine which quota to consume
        if customer_id:
            doc_ref = self.db.collection('rate_limits').document(f'customer_{customer_id}')
            limit = self.daily_limit
        elif session_id:
            doc_ref = self.db.collection('rate_limits').document(f'session_{session_id}')
            limit = self.burst_limit
        else:
            doc_ref = self.db.collection('rate_limits').document(f'ip_{ip_address}')
            limit = self.daily_limit

        # Atomic transaction
        @firestore.transactional
        def increment_batch_count(transaction, doc_ref):
            snapshot = doc_ref.get(transaction=transaction)

            if not snapshot.exists:
                # First use - check if enough quota
                if count > limit:
                    raise ValueError(f"Insufficient quota: need {count}, have {limit}")

                # Initialize with batch count
                transaction.set(doc_ref, {
                    'count': count,
                    'reset_date': self._get_reset_date(),
                    'last_used': firestore.SERVER_TIMESTAMP,
                    'style': 'batch'
                })
                return QuotaStatus(
                    allowed=True,
                    remaining=limit - count,
                    limit=limit,
                    reset_time=self._get_reset_date().isoformat()
                )

            data = snapshot.to_dict()
            current_count = data.get('count', 0)
            reset_date = data.get('reset_date')

            # Check if quota needs reset (new day)
            if reset_date < self._get_reset_date():
                if count > limit:
                    raise ValueError(f"Insufficient quota: need {count}, have {limit}")

                transaction.update(doc_ref, {
                    'count': count,
                    'reset_date': self._get_reset_date(),
                    'last_used': firestore.SERVER_TIMESTAMP,
                    'style': 'batch'
                })
                return QuotaStatus(
                    allowed=True,
                    remaining=limit - count,
                    limit=limit,
                    reset_time=self._get_reset_date().isoformat()
                )

            # Check if enough quota available
            if current_count + count > limit:
                raise ValueError(f"Insufficient quota: need {count}, have {limit - current_count}")

            # Increment count by batch amount
            new_count = current_count + count
            transaction.update(doc_ref, {
                'count': new_count,
                'last_used': firestore.SERVER_TIMESTAMP,
                'style': 'batch'
            })

            return QuotaStatus(
                allowed=True,
                remaining=max(0, limit - new_count),
                limit=limit,
                reset_time=reset_date.isoformat()
            )

        # Execute transaction
        transaction = self.db.transaction()
        return increment_batch_count(transaction, doc_ref)


# Singleton instance
rate_limiter = RateLimiter()
