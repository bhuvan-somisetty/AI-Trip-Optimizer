import uuid

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import AuditEvent, AuditEventType, User, UserRole
from app.schemas import AuditEventResponse
from app.security import get_current_user

router = APIRouter(tags=["audit"])


@router.get("/audit", response_model=list[AuditEventResponse])
def list_audit_events(
    trip_id: uuid.UUID | None = None,
    event_type: AuditEventType | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Audit history, newest first.

    Admins see every user's events (PRD US-010: "as an admin ... the team's workflow is
    traceable"); members see only their own. A trip_id the caller can't see just returns
    an empty list, so the endpoint doesn't reveal which trip IDs exist.
    """
    query = select(AuditEvent, User.email).join(User, User.id == AuditEvent.user_id)
    if current_user.role != UserRole.admin:
        query = query.where(AuditEvent.user_id == current_user.id)
    if trip_id is not None:
        query = query.where(AuditEvent.trip_id == trip_id)
    if event_type is not None:
        query = query.where(AuditEvent.event_type == event_type)
    rows = session.exec(query.order_by(AuditEvent.created_at.desc()).limit(limit)).all()
    return [
        AuditEventResponse(
            id=event.id,
            trip_id=event.trip_id,
            event_type=event.event_type,
            actor=email,
            summary=event.summary,
            payload=event.payload,
            created_at=event.created_at,
        )
        for event, email in rows
    ]
