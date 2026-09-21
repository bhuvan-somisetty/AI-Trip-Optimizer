import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Traveler, Trip, User
from app.schemas import TripCreate, TripResponse
from app.security import get_current_user

router = APIRouter(tags=["trips"])


def get_owned_trip(
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Trip:
    """Load a trip the current user created, or 404.

    Someone else's trip returns the same 404 as a missing one, so the API doesn't
    reveal which trip IDs exist. Reuse this dependency on every /trips/{trip_id}/... route.
    """
    trip = session.get(Trip, trip_id)
    if trip is None or trip.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return trip


@router.post("/trip", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
def create_trip(
    body: TripCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    traveler = session.get(Traveler, body.traveler_id)
    if traveler is None or traveler.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Traveler not found")

    trip = Trip(
        traveler_id=body.traveler_id,
        start_date=body.dates[0],
        end_date=body.dates[1],
        budget=body.budget,
        preferences=body.preferences,
        created_by=current_user.id,
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return trip
