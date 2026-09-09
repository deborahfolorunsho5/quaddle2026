from pydantic import BaseModel, ConfigDict


class UserBrief(BaseModel):
    """Just enough of a user to render a name and link to their profile."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
