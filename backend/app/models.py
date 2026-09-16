import uuid
from datetime import datetime, timezone
from enum import Enum

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
