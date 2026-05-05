import os
import tempfile
import boto3
from config import settings


def download_video(s3_key: str) -> str:
    """Download a video from S3 to a local temp file. Returns the file path."""
    client = boto3.client(
        "s3",
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_key,
        aws_secret_access_key=settings.s3_secret,
    )
    suffix = os.path.splitext(s3_key)[-1] or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    client.download_fileobj(settings.s3_bucket, s3_key, tmp)
    tmp.close()
    return tmp.name
