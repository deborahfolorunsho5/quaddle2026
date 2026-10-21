"""add a profile photo to users

Revision ID: e4c1d2a9b7f3
Revises: 9612f899d113
Create Date: 2026-10-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4c1d2a9b7f3'
down_revision: Union[str, Sequence[str], None] = '9612f899d113'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('avatar_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users') as batch:
        batch.drop_column('avatar_url')
