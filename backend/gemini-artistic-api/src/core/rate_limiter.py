"""Firestore-based rate limiting with atomic transactions"""
from google.cloud import firestore
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional
from src.config import settings
from src.models.schemas import QuotaStatus

logger = logging.getLogger(__name__)


def calculate_warning_level(remaining: int, limit: int) -> int:
    """
    Calculate warning level based on remaining quota

    Levels:
    - 1 (Silent): 6-4 remaining - minimal badge indicator
    - 2 (Reminder): 3 remaining - show toast notification
    - 3 (Warning): 1-2 remaining - show prominent warning banner
    - 4 (Exhausted): 0 remaining - disable buttons, show alternatives
    """
    if remaining == 0:
        return 4
    elif remaining <= 2:
        return 3
    elif remaining == 3:
        return 2
    else:
        return 1


class RateLimiter:
    """Three-tier rate limiting using Firestore with atomic transactions"""

    def __init__(self):
        self.db = firestore.Client(project=settings.project_id)
        self.daily_limit = settings.rate_limit_daily
        self.burst_limit = settings.rate_limit_burst
        self.custom_daily_limit = settings.rate_limit_custom_daily
        logger.info(f"Initialized rate limiter: daily={self.daily_limit}, burst={self.burst_limit}, custom={self.custom_daily_limit}")

    def _get_reset_date(self) -> datetime:
        """Get next midnight UTC reset time"""
        now = datetime.now(timezone.utc)
        tomorrow = now + timedelta(days=1)
        return tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

    def _get_limit(self, quota_type: str, identity_type: str) -> int:
        """Get the limit for a given quota type and identity type"""
        if quota_type == "custom":
            return self.custom_daily_limit
        if identity_type == "session":
            return self.burst_limit
        return self.daily_limit

    async def check_rate_limit(
        self,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        quota_type: str = "named"
    ) -> QuotaStatus:
        """
        Check rate limit without consuming quota

        Priority: customer_id > session_id > ip_address
        quota_type: "named" (10/day) or "custom" (3/day)
        """
        # Determine which quota to check
        if customer_id:
            doc_ref = self.db.collection('rate_limits').document(f'customer_{customer_id}_{quota_type}')
            limit = self._get_limit(quota_type, "customer")
        elif session_id:
            doc_ref = self.db.collection('rate_limits').document(f'session_{session_id}_{quota_type}')
            limit = self._get_limit(quota_type, "session")
        else:
            doc_ref = self.db.collection('rate_limits').document(f'ip_{ip_address}_{quota_type}')
            limit = self._get_limit(quota_type, "ip")

        # Get current status
        doc = doc_ref.get()

        if not doc.exists:
            # First use - allow
            return QuotaStatus(
                allowed=True,
                remaining=limit,
                limit=limit,
                reset_time=self._get_reset_date().isoformat(),
                warning_level=calculate_warning_level(limit, limit)
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
                reset_time=self._get_reset_date().isoformat(),
                warning_level=calculate_warning_level(limit, limit)
            )

        # Check if under limit
        remaining = max(0, limit - current_count)
        allowed = remaining > 0

        return QuotaStatus(
            allowed=allowed,
            remaining=remaining,
            limit=limit,
            reset_time=reset_date.isoformat(),
            warning_level=calculate_warning_level(remaining, limit)
        )

    async def consume_quota(
        self,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        style: Optional[str] = None,
        quota_type: str = "named"
    ) -> QuotaStatus:
        """
        Atomically consume quota using Firestore transaction

        This prevents race conditions with concurrent requests
        quota_type: "named" (10/day) or "custom" (3/day)
        """
        # Determine which quota to consume
        if customer_id:
            doc_ref = self.db.collection('rate_limits').document(f'customer_{customer_id}_{quota_type}')
            limit = self._get_limit(quota_type, "customer")
        elif session_id:
            doc_ref = self.db.collection('rate_limits').document(f'session_{session_id}_{quota_type}')
            limit = self._get_limit(quota_type, "session")
        else:
            doc_ref = self.db.collection('rate_limits').document(f'ip_{ip_address}_{quota_type}')
            limit = self._get_limit(quota_type, "ip")

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
                    reset_time=self._get_reset_date().isoformat(),
                    warning_level=calculate_warning_level(limit - 1, limit)
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
                    reset_time=self._get_reset_date().isoformat(),
                    warning_level=calculate_warning_level(limit - 1, limit)
                )

            # Increment count
            new_count = current_count + 1
            transaction.update(doc_ref, {
                'count': new_count,
                'last_used': firestore.SERVER_TIMESTAMP,
                'style': style
            })

            remaining = max(0, limit - new_count)
            return QuotaStatus(
                allowed=True,
                remaining=remaining,
                limit=limit,
                reset_time=reset_date.isoformat(),
                warning_level=calculate_warning_level(remaining, limit)
            )

        # Execute transaction
        transaction = self.db.transaction()
        return increment_count(transaction, doc_ref)


# Singleton instance
rate_limiter = RateLimiter()
