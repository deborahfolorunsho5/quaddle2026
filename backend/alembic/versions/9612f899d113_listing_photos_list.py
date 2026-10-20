"""replace listing image_url with an image_urls list

Revision ID: 9612f899d113
Revises: b58e30ac6f42
Create Date: 2026-10-20 16:52:47.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9612f899d113'
down_revision: Union[str, Sequence[str], None] = 'b58e30ac6f42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

listings = sa.table(
    'listings',
    sa.column('id', sa.Integer),
    sa.column('image_url', sa.String),
    sa.column('image_urls', sa.JSON),
)


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'listings',
        sa.Column('image_urls', sa.JSON(), nullable=False, server_default='[]'),
    )
    # Copied row by row through SQLAlchemy's JSON type rather than in SQL, so
    # the same migration works on Postgres and on a local SQLite database.
    conn = op.get_bind()
    rows = conn.execute(
        sa.select(listings.c.id, listings.c.image_url).where(
            listings.c.image_url.is_not(None)
        )
    ).all()
    for listing_id, image_url in rows:
        conn.execute(
            listings.update()
            .where(listings.c.id == listing_id)
            .values(image_urls=[image_url])
        )
    # Batch mode, because SQLite can only drop a column by rebuilding the table.
    with op.batch_alter_table('listings') as batch:
        batch.drop_column('image_url')


def downgrade() -> None:
    """Downgrade schema. Only the cover photo survives: the old column held one."""
    op.add_column('listings', sa.Column('image_url', sa.String(length=500), nullable=True))
    conn = op.get_bind()
    rows = conn.execute(sa.select(listings.c.id, listings.c.image_urls)).all()
    for listing_id, image_urls in rows:
        if image_urls:
            conn.execute(
                listings.update()
                .where(listings.c.id == listing_id)
                .values(image_url=image_urls[0])
            )
    with op.batch_alter_table('listings') as batch:
        batch.drop_column('image_urls')
