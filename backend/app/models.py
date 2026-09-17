import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field


class UserRole(str, Enum):
    member = "member"
    admin = "admin"


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
