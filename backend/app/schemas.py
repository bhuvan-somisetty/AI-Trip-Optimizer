import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models import TripStatus, UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: UserRole = UserRole.member


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole


class TravelerCreate(BaseModel):
    name: str
    preferences: dict = {}


class TravelerResponse(BaseModel):
    id: uuid.UUID
    name: str
    preferences: dict
    created_by: uuid.UUID


class TripCreate(BaseModel):
    traveler_id: uuid.UUID
    dates: tuple[date, date]  # [start, end], matches 07_API_Specification.md
    budget: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    preferences: dict = {}

    @model_validator(mode="after")
    def end_not_before_start(self):
        if self.dates[1] < self.dates[0]:
            raise ValueError("End date cannot be before start date")
        return self


class TripResponse(BaseModel):
    id: uuid.UUID
    traveler_id: uuid.UUID
    dates: tuple[date, date]
    budget: Decimal
    preferences: dict
    status: TripStatus
    created_by: uuid.UUID

    @model_validator(mode="before")
    @classmethod
    def build_dates(cls, data):
        # Trip rows store start_date/end_date; the API exposes them as one `dates` pair.
        if hasattr(data, "start_date"):
            return {
                "id": data.id,
                "traveler_id": data.traveler_id,
                "dates": (data.start_date, data.end_date),
                "budget": data.budget,
                "preferences": data.preferences,
                "status": data.status,
                "created_by": data.created_by,
            }
        return data
