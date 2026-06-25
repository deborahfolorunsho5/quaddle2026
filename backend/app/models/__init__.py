# Import every model here so Alembic's autogenerate sees them all
# via Base.metadata. Add new models to this list as you create them.
from app.models.university import University  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.listing import Listing  # noqa: F401