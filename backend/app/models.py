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
    # None for accounts created through Google sign-in, which have no password.
    hashed_password: str | None = None
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
    origin: str = Field(max_length=3)  # IATA airport code, e.g. "BLR"
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
    # None when no return fare was found, and on itineraries saved before returns were searched.
    return_flight: dict | None = Field(default=None, sa_column=Column(JSON))
    hotel: dict | None = Field(default=None, sa_column=Column(JSON))  # None for a same-day trip
    total_cost: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    # PRD US-010: the median options that met every rule minus the chosen ones. None on
    # itineraries saved before savings were worked out.
    savings: Decimal | None = Field(default=None, sa_column=Column(Numeric(12, 2)))
    within_budget: bool
    flags: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    rationale: str
    tradeoff_ledger: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    # The run's flight/hotel options, so a reviewer can swap a line item without searching
    # again. None for itineraries saved before edits existed; those need a re-run first.
    search_results: dict | None = Field(default=None, sa_column=Column(JSON))
    # Line items ("flight"/"return"/"stay") a reviewer swapped in by hand; empty for the optimizer's own pick.
    picked: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))
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


class AuditEventType(str, Enum):
    # Same names as the frontend's AuditEvent["type"], so its audit page can show these as-is.
    TRAVELER_CREATED = "TRAVELER_CREATED"
    TRAVELER_UPDATED = "TRAVELER_UPDATED"
    TRAVELER_DELETED = "TRAVELER_DELETED"
    TRIP_CREATED = "TRIP_CREATED"
    PIPELINE_RUN = "PIPELINE_RUN"
    PIPELINE_FAILED = "PIPELINE_FAILED"
    REVIEW_STARTED = "REVIEW_STARTED"
    DECISION = "DECISION"
    ITINERARY_EDITED = "ITINERARY_EDITED"


class AuditEvent(SQLModel, table=True):
    """Append-only history of who did what (PRD: Audit trail). Rows are never edited or deleted.

    Kept separate from itineraries on purpose: re-optimizing replaces a trip's itinerary,
    but every earlier pipeline run stays here with what it chose and why.
    """

    __tablename__ = "audit_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID | None = Field(default=None, foreign_key="trips.id", index=True)  # None for traveler events
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)  # who did it
    event_type: AuditEventType = Field(
        sa_column=Column(SAEnum(AuditEventType, native_enum=False, length=32), nullable=False, index=True)
    )
    summary: str  # one readable line, e.g. "Optimized BLR→DEL: total 11,667, within budget"
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
