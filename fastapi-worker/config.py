from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_host: str = "mysql"
    db_name: str = "hawkvision"
    db_user: str = "hawkvision"
    db_pass: str = "secret"
    redis_host: str = "redis"
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_key: str = ""
    s3_secret: str = ""

    @property
    def db_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_pass}"
            f"@{self.db_host}/{self.db_name}?charset=utf8mb4"
        )

    class Config:
        env_file = ".env"


settings = Settings()
