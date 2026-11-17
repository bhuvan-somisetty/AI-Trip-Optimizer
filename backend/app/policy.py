"""The company travel policy (Settings > Travel policy), as the optimizer and the API read it.

One policy for the whole company, edited by admins only. Until an admin saves one, the defaults
below apply; they match the web app's defaults (Vistara left out: it merged into Air India).
"""
from sqlmodel import Session, select

from app.models import TravelPolicy, User

DEFAULT_POLICY = {
    "manager_approval_flight_over": 25000.0,
    "max_nightly_rate": 8000.0,
    "max_nightly_rate_intl": 18000.0,
    "business_class_min_hours": 6.0,
    "advance_booking_days": 14,
    "preferred_airlines": ["IndiGo", "Air India", "Emirates", "Singapore Airlines"],
}


def saved_policy(session: Session) -> TravelPolicy | None:
    return session.exec(select(TravelPolicy).where(TravelPolicy.id == 1)).first()


def load_policy(session: Session) -> dict:
    """The policy as plain numbers and lists, ready for the pipeline and for audit payloads."""
    row = saved_policy(session)
    if row is None:
        return {**DEFAULT_POLICY, "preferred_airlines": list(DEFAULT_POLICY["preferred_airlines"])}
    return {
        "manager_approval_flight_over": float(row.manager_approval_flight_over),
        "max_nightly_rate": float(row.max_nightly_rate),
        "max_nightly_rate_intl": float(row.max_nightly_rate_intl),
        "business_class_min_hours": float(row.business_class_min_hours),
        "advance_booking_days": int(row.advance_booking_days),
        "preferred_airlines": list(row.preferred_airlines or []),
    }


def policy_response(session: Session) -> dict:
    row = saved_policy(session)
    updated_by = session.get(User, row.updated_by) if row and row.updated_by else None
    return {
        **load_policy(session),
        "updated_at": row.updated_at if row else None,
        "updated_by": updated_by.email if updated_by else None,
    }
