"""create conversations and messages

Revision ID: b58e30ac6f42
Revises: a41c9f2b7d18
Create Date: 2026-09-07 09:31:47.220614

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b58e30ac6f42'
down_revision: Union[str, Sequence[str], None] = 'a41c9f2b7d18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_a_id', sa.Integer(), nullable=False),
        sa.Column('user_b_id', sa.Integer(), nullable=False),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        # The lower id always goes first, so one pair cannot get two threads.
        sa.CheckConstraint('user_a_id < user_b_id', name='ck_conversations_pair_order'),
        sa.ForeignKeyConstraint(['user_a_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_b_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_a_id', 'user_b_id', name='uq_conversations_pair'),
    )
    op.create_index(
        op.f('ix_conversations_user_a_id'), 'conversations', ['user_a_id'], unique=False
    )
    op.create_index(
        op.f('ix_conversations_user_b_id'), 'conversations', ['user_b_id'], unique=False
    )

    op.create_table(
        'messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'], unique=False
    )
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)
    op.create_index(op.f('ix_messages_created_at'), 'messages', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_messages_created_at'), table_name='messages')
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_conversation_id'), table_name='messages')
    op.drop_table('messages')

    op.drop_index(op.f('ix_conversations_user_b_id'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_user_a_id'), table_name='conversations')
    op.drop_table('conversations')
