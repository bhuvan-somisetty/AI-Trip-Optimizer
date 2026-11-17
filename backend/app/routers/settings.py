"""Settings page endpoints: your own profile, and the company travel policy."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.audit import record
from app.database import get_session
from app.models import AuditEventType, TravelPolicy, User
from app.policy import load_policy, policy_response, saved_policy
from app.schemas import ProfileUpdate, TravelPolicyBody, TravelPolicyResponse, UserResponse
from app.security import get_current_user, require_admin

router = APIRouter(tags=["settings"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    current_user.name = body.name
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.get("/policy", response_model=TravelPolicyResponse)
def get_policy(_: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Everyone signed in can read the policy their trips are checked against.
    return policy_response(session)


@router.put("/policy", response_model=TravelPolicyResponse)
def update_policy(
    body: TravelPolicyBody,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    before = load_policy(session)
    row = saved_policy(session) or TravelPolicy(id=1, **body.model_dump())
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    row.updated_by = admin.id
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.flush()

    after = load_policy(session)  # same plain numbers as `before`, so they compare cleanly
    changes = {key: {"before": before[key], "after": after[key]} for key in after if after[key] != before[key]}
    if changes:
        record(
            session, user=admin, event_type=AuditEventType.POLICY_UPDATED,
            summary=f"Updated travel policy: changed {', '.join(changes)}",
            payload={"changes": changes},
        )
    session.commit()
    return policy_response(session)
