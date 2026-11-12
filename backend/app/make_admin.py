"""Make an existing account an admin.

Sign-up only ever creates members, so this is the one way to get an admin. The person
signs up first (email/password or Google), then from the backend folder:

    python -m app.make_admin someone@example.com

It uses DATABASE_URL like the API does, so point that at the production database to
promote someone there. Running it again for an admin changes nothing.
"""
import sys

from sqlmodel import Session, func, select

from app.database import engine
from app.models import User, UserRole


def make_admin(session: Session, email: str) -> str:
    """Promotes the account with this email and says what happened; raises LookupError if there's none."""
    # Emails are stored as typed at sign-up, so match without caring about case.
    email = email.strip()
    user = session.exec(select(User).where(func.lower(User.email) == email.lower())).first()
    if user is None:
        raise LookupError(f"No account with email {email}. Sign up first, then run this again.")
    if user.role == UserRole.admin:
        return f"{email} is already an admin."
    user.role = UserRole.admin
    session.add(user)
    session.commit()
    return f"{email} is now an admin. They need to sign in again to get an admin token."


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("Usage: python -m app.make_admin <email>")
        return 2
    with Session(engine) as session:
        try:
            print(make_admin(session, argv[0]))
        except LookupError as e:
            print(e)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
