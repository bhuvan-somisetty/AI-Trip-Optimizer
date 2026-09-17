import uuid

from pydantic import BaseModel, EmailStr

from app.models import UserRole


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
