"""Firestore-based rate limiting with atomic transactions"""
from google.cloud import firestore
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional
from src.config import settings
from src.models.schemas import QuotaStatus

logger = logging.getLogger(__name__)


class RateLimiter:
    """Three-tier rate limiting using Firestore with atomic transactions"""

    def __init__(self):
        self.db = firestore.Client(project=settings.project_id)
        self.daily_limit = settings.rate_limit_daily
        self.burst_limit = settings.rate_limit_burst
        logger.info(f"Initialized rate limiter: daily={self.daily_limit}, burst={self.burst_limit}")

    def _get_reset_date(self) -> datetime:
        """Get next midnight UTC reset time"""
        now = datetime.now(timezone.utc)
        tomorrow = now + timedelta(days=1)
        return tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

    async def check_rate_limit(
        self,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> QuotaStatus:
        """
        Check rate limit without consuming quota

        Priority: customer_id > session_id > ip_address
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

        # Get current status
        doc = doc_ref.get()

        if not doc.exists:
            # First use - allow
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

        # Check if under limit
        remaining = max(0, limit - current_count)
        allowed = remaining > 0

        return QuotaStatus(
            allowed=allowed,
            remaining=remaining,
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

        This prevents race conditions with concurrent requests
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
                # First use - initialize
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

            # Check if quota needs reset
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


# Singleton instance
rate_limiter = RateLimiter()
