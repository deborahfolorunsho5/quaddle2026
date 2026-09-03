"""add location to listings

Revision ID: c7a15e3b8d40
Revises: 8c03707f4dd3
Create Date: 2026-09-03 10:12:44.108331

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7a15e3b8d40'
down_revision: Union[str, Sequence[str], None] = '8c03707f4dd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('listings', sa.Column('longitude', sa.Float(), nullable=True))
    # Existing rows have no pin, so nothing to hide; default them to exact.
    op.add_column(
        'listings',
        sa.Column(
            'location_is_approximate',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('listings', 'location_is_approximate')
    op.drop_column('listings', 'longitude')
    op.drop_column('listings', 'latitude')
