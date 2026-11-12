from sqlmodel import create_engine, Session

from app.config import DATABASE_URL

# pool_pre_ping checks a pooled connection before reusing it. Neon closes idle connections
# when the database scales to zero, and without the check the first request after a quiet
# spell fails with "SSL connection has been closed unexpectedly".
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)


def get_session():
    with Session(engine) as session:
        yield session
