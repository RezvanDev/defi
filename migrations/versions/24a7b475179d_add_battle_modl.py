"""Add Battle modl

Revision ID: 24a7b475179d
Revises: bb408aac9318
Create Date: 2024-11-09 11:59:08.308277

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '24a7b475179d'
down_revision = 'bb408aac9318'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('battle', schema=None) as batch_op:
        batch_op.drop_constraint('fk_battle_winner_id_user', type_='foreignkey')
        batch_op.drop_column('opponent_results')
        batch_op.drop_column('creator_results')
        batch_op.drop_column('winner_id')

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('battle', schema=None) as batch_op:
        batch_op.add_column(sa.Column('winner_id', sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column('creator_results', sa.VARCHAR(), server_default=sa.text("'[null,null,null]'"), nullable=True))
        batch_op.add_column(sa.Column('opponent_results', sa.VARCHAR(), server_default=sa.text("'[null,null,null]'"), nullable=True))
        batch_op.create_foreign_key('fk_battle_winner_id_user', 'user', ['winner_id'], ['id'], ondelete='SET NULL')

    # ### end Alembic commands ###
