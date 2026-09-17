import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Traveler, User
from app.schemas import TravelerCreate, TravelerResponse
from app.security import get_current_user

router = APIRouter(tags=["travelers"])


@router.post("/traveler", response_model=TravelerResponse, status_code=status.HTTP_201_CREATED)
def create_traveler(
    body: TravelerCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    traveler = Traveler(name=body.name, preferences=body.preferences, created_by=current_user.id)
    session.add(traveler)
    session.commit()
    session.refresh(traveler)
    return traveler


@router.get("/travelers", response_model=list[TravelerResponse])
def list_travelers(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(select(Traveler).where(Traveler.created_by == current_user.id)).all()


@router.delete("/traveler/{traveler_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_traveler(
    traveler_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    traveler = session.get(Traveler, traveler_id)
    if traveler is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Traveler not found")
    # PRD US-001: a traveler with existing trips cannot be deleted (409). The trips
    # table doesn't exist yet, so that check is added when trips.py is built.
    session.delete(traveler)
    session.commit()
