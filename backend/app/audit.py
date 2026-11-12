"""Writes audit events (PRD: Audit trail, US-010 "every decision and pipeline run remains in the audit history").

record() only adds the row to the session. The caller's own commit saves it, so an action
and its audit event are saved together or not at all.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlmodel import Session

from app.models import AuditEvent, AuditEventType, User


def _jsonable(value):
    # Payloads go into a JSON column; budgets are Decimal and trip dates are date objects.
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def record(
    session: Session,
    *,
    user: User,
    event_type: AuditEventType,
    summary: str,
    trip_id: uuid.UUID | None = None,
    payload: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        trip_id=trip_id,
        user_id=user.id,
        event_type=event_type,
        summary=summary,
        payload=_jsonable(payload or {}),
    )
    session.add(event)
    return event
