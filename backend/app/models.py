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
    created_by: uuid.UUID = Field(foreign_key="users.id")


class Trip(SQLModel, table=True):
    __tablename__ = "trips"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    traveler_id: uuid.UUID = Field(foreign_key="travelers.id", index=True)
    start_date: date
    end_date: date
    budget: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    preferences: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: TripStatus = Field(
        default=TripStatus.DRAFT,
        sa_column=Column(SAEnum(TripStatus, native_enum=False, length=32), nullable=False, index=True),
    )
    created_by: uuid.UUID = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
