from pydantic import BaseModel, ConfigDict


class UniversityRead(BaseModel):
    """Shape of a university as returned by the API."""
    # Lets Pydantic read data straight off a SQLAlchemy model object.
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str