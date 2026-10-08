import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum

from sqlalchemy import Column, JSON, Numeric
from sqlalchemy import Enum as SAEnum
from sqlmodel import SQLModel, Field


class UserRole(str, Enum):
    member = "member"
    admin = "admin"


class TripStatus(str, Enum):
    DRAFT = "DRAFT"
    OPTIMIZING = "OPTIMIZING"
    OPTIMIZED = "OPTIMIZED"
    UNDER_REVIEW = "UNDER_REVIEW"
    DECIDED = "DECIDED"
    OPTIMIZATION_FAILED = "OPTIMIZATION_FAILED"


class DecisionOutcome(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: UserRole = Field(default=UserRole.member)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Traveler(SQLModel, table=True):
    __tablename__ = "travelers"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    preferences: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_by: uuid.UUID = Field(foreign_key="users.id", index=True)


class Trip(SQLModel, table=True):
    __tablename__ = "trips"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    traveler_id: uuid.UUID = Field(foreign_key="travelers.id", index=True)
    origin: str = Field(max_length=3)  # airport code, e.g. "BLR" (matches data/mock_flights.json)
    destination: str = Field(max_length=3)
    start_date: date
    end_date: date
    budget: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    preferences: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: TripStatus = Field(
        default=TripStatus.DRAFT,
        sa_column=Column(SAEnum(TripStatus, native_enum=False, length=32), nullable=False, index=True),
    )
    failure_reason: str | None = None  # why the last optimize run failed, cleared on the next run
    created_by: uuid.UUID = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Itinerary(SQLModel, table=True):
    """The pipeline's latest result for a trip; re-optimizing replaces it."""

    __tablename__ = "itineraries"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trips.id", unique=True, index=True)
    flight: dict = Field(sa_column=Column(JSON, nullable=False))
    hotel: dict | None = Field(default=None, sa_column=Column(JSON))  # None for a same-day trip
    total_cost: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    within_budget: bool
    flags: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    rationale: str
    tradeoff_ledger: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Decision(SQLModel, table=True):
    """A human approve/reject on a trip's itinerary (PRD US-007). Rows are never edited."""

    __tablename__ = "decisions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trips.id", index=True)
    decided_by: uuid.UUID = Field(foreign_key="users.id")
    outcome: DecisionOutcome = Field(
        sa_column=Column(SAEnum(DecisionOutcome, native_enum=False, length=16), nullable=False)
    )
    reason: str | None = None  # required when outcome is REJECTED
    decided_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
