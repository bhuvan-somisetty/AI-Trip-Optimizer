from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlmodel import Session, select

from app import config
from app.database import get_session
from app.models import User, UserRole
from app.schemas import GoogleLoginRequest, LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Self sign-up always creates a member; a client can't make itself an admin.
    user = User(email=body.email, hashed_password=hash_password(body.password), role=UserRole.member)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    # Accounts made through Google have no password, so a password login can't match them.
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(user_id=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token)


@router.post("/google", response_model=TokenResponse)
def google_login(body: GoogleLoginRequest, session: Session = Depends(get_session)):
    if not config.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in isn't set up")

    # Checks Google's signature, expiry, issuer and that the token was issued for our client ID.
    try:
        info = id_token.verify_oauth2_token(body.credential, google_requests.Request(), config.GOOGLE_CLIENT_ID)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google sign-in")
    if not info.get("email") or not info.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account email isn't verified")

    # Signs in the account with that email, or creates a member account the first time.
    email = info["email"]
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        user = User(email=email, hashed_password=None, role=UserRole.member)
        session.add(user)
        session.commit()
        session.refresh(user)

    token = create_access_token(user_id=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token)
