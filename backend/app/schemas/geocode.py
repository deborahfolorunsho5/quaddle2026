from pydantic import BaseModel


class GeocodeResult(BaseModel):
    """One candidate match for a typed location. Several come back for a vague
    query, so the provider picks which one they meant rather than us guessing."""
    display_name: str
    latitude: float
    longitude: float
