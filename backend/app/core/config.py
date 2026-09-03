from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, loaded from environment variables / the .env file."""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Quad"
    # Quad is open to one campus at a time. This must match a row in the
    # universities table exactly (see backend/data/us_universities.json).
    ACTIVE_CAMPUS_NAME: str = "University of Illinois Chicago"
    DATABASE_URL: str = "sqlite:///./quaddle.db"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Where the React app runs — needed so the browser allows it to call this API.
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Location search is proxied through us rather than called from the browser:
    # Nominatim sends no CORS headers to a successful request and rejects
    # unidentified clients outright, and proxying keeps students' IP addresses
    # off a third party. Its usage policy wants a real contact in the agent.
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org/search"
    GEOCODER_USER_AGENT: str = "Quad campus marketplace (local development)"
    GEOCODER_TIMEOUT_SECONDS: float = 6.0

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_postgres_scheme(cls, value: str) -> str:
        """Managed hosts hand out postgres:// URLs, a scheme SQLAlchemy 2.0 no
        longer recognises, so the app would die on the first connection."""
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql://", 1)
        return value


settings = Settings()