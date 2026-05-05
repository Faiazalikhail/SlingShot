from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from config import settings

engine = create_engine(settings.db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def update_session_status(session_id: str, status: str) -> None:
    with SessionLocal() as db:
        db.execute(
            text("UPDATE sessions SET status = :status WHERE id = :id"),
            {"status": status, "id": session_id},
        )
        db.commit()


def save_tracks(session_id: str, track_data: dict) -> None:
    import json

    with SessionLocal() as db:
        db.execute(
            text(
                "INSERT INTO session_tracks (session_id, track_data) VALUES (:sid, :data)"
                " ON DUPLICATE KEY UPDATE track_data = VALUES(track_data)"
            ),
            {"sid": session_id, "data": json.dumps(track_data)},
        )
        db.commit()
