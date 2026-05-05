"""
RQ task executed by the `rq worker` process.

The PHP side pushes a JSON envelope onto `rq:queue:hawkvision`.
RQ deserialises it and calls `process_video(payload)`.
"""

import logging
import os

from database import save_tracks, update_session_status
from storage import download_video
from cv_pipeline import run_pipeline

logger = logging.getLogger(__name__)


def process_video(payload: dict) -> None:
    session_id = payload["session_id"]
    s3_key     = payload["s3_key"]
    fps        = float(payload.get("fps", 30))

    logger.info("Starting processing for session %s", session_id)
    update_session_status(session_id, "processing")

    local_path = None
    try:
        local_path = download_video(s3_key)
        result     = run_pipeline(local_path, fps)
        save_tracks(session_id, result)
        update_session_status(session_id, "done")
        logger.info("Finished session %s — %d frames", session_id, len(result["frames"]))
    except Exception as exc:
        logger.exception("Pipeline failed for session %s: %s", session_id, exc)
        update_session_status(session_id, "failed")
        raise
    finally:
        if local_path and os.path.exists(local_path):
            os.unlink(local_path)
