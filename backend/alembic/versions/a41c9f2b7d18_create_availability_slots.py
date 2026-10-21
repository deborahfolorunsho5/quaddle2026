"""create availability slots and point bookings at them

Revision ID: a41c9f2b7d18
Revises: c7a15e3b8d40
Create Date: 2026-09-07 09:14:02.551908

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a41c9f2b7d18'
down_revision: Union[str, Sequence[str], None] = 'c7a15e3b8d40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'availability_slots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint('ends_at > starts_at', name='ck_availability_slots_order'),
        sa.ForeignKeyConstraint(['provider_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'provider_id', 'starts_at', name='uq_availability_slots_provider_start'
        ),
    )
    op.create_index(
        op.f('ix_availability_slots_provider_id'),
        'availability_slots',
        ['provider_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_availability_slots_starts_at'),
        'availability_slots',
        ['starts_at'],
        unique=False,
    )

    # Batch mode because SQLite cannot add a constraint to an existing table:
    # there it rebuilds the table, and PostgreSQL gets the same plain ALTERs.
    with op.batch_alter_table('bookings') as batch:
        batch.add_column(sa.Column('slot_id', sa.Integer(), nullable=True))
        batch.add_column(
            sa.Column('requested_end', sa.DateTime(timezone=True), nullable=True)
        )
        batch.create_foreign_key(
            'fk_bookings_slot_id', 'availability_slots', ['slot_id'], ['id']
        )
        # At most one live booking per slot. Both PostgreSQL and SQLite allow
        # repeated nulls here, which is what lets a declined booking free its time.
        batch.create_unique_constraint('uq_bookings_slot', ['slot_id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('bookings') as batch:
        batch.drop_constraint('uq_bookings_slot', type_='unique')
        batch.drop_constraint('fk_bookings_slot_id', type_='foreignkey')
        batch.drop_column('requested_end')
        batch.drop_column('slot_id')

    op.drop_index(
        op.f('ix_availability_slots_starts_at'), table_name='availability_slots'
    )
    op.drop_index(
        op.f('ix_availability_slots_provider_id'), table_name='availability_slots'
    )
    op.drop_table('availability_slots')
