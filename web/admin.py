from flask_admin import Admin, AdminIndexView, expose
from flask_admin.contrib.sqla import ModelView
from flask_admin.actions import action
from flask_login import current_user, login_user
from flask import redirect, url_for, flash, request
from markupsafe import Markup
from werkzeug.security import check_password_hash
from web.auth import User, Task, UserTask, Transaction, Withdrawal, db
from datetime import datetime

class SecureModelView(ModelView):
    def is_accessible(self):
        return current_user.is_authenticated and current_user.username == 'admin'

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('admin.login_view'))

class SecureAdminIndexView(AdminIndexView):
    @expose('/')
    def index(self):
        if not current_user.is_authenticated or current_user.username != 'admin':
            return redirect(url_for('admin.login_view'))
        return super(SecureAdminIndexView, self).index()

    @expose('/login/', methods=('GET', 'POST'))
    def login_view(self):
        if request.method == 'POST':
            username = request.form.get('username')
            password = request.form.get('password')
            user = User.query.filter_by(username=username).first()
            if user and user.username == 'admin' and check_password_hash(user.token_hash, password):
                login_user(user)
                return redirect(url_for('admin.index'))
            flash('Invalid username or password')
        return self.render('admin/login.html')

class UserAdmin(SecureModelView):
    column_list = ('id', 'username', 'cash', 'withdrawal_balance', 'total_earned', 'freespins', 'telegram_id', 'created_on',
                   'referral_code', 'referral_earnings', 'referrer', 'referrals_count', 'active_withdrawals', 'completed_withdrawals')
    column_searchable_list = ['username', 'telegram_id', 'referral_code']
    column_filters = ['cash', 'withdrawal_balance', 'total_earned', 'freespins', 'referral_earnings']

    can_delete = True

    def delete_model(self, model):
        if model.username == 'admin':
            flash('Невозможно удалить администратора', 'error')
            return False
        return super(UserAdmin, self).delete_model(model)

    def _referrals_count(view, context, model, name):
        return len(model.referrals)

    def _referrer_formatter(view, context, model, name):
        return model.referrer.username if model.referrer else 'Нет'

    def _active_withdrawals(view, context, model, name):
        return Withdrawal.query.filter_by(user_id=model.id, status='pending').count()

    def _completed_withdrawals(view, context, model, name):
        return Withdrawal.query.filter_by(user_id=model.id, status='completed').count()

    column_formatters = {
        'referrals_count': _referrals_count,
        'referrer': _referrer_formatter,
        'active_withdrawals': _active_withdrawals,
        'completed_withdrawals': _completed_withdrawals
    }

    column_labels = {
        'id': 'ID',
        'username': 'Имя пользователя',
        'cash': 'Игровой баланс',
        'withdrawal_balance': 'Баланс для вывода',
        'total_earned': 'Всего заработано',
        'freespins': 'Фриспины',
        'telegram_id': 'Telegram ID',
        'created_on': 'Дата регистрации',
        'referral_code': 'Реферальный код',
        'referral_earnings': 'Заработок с рефералов',
        'referrer': 'Пригласивший пользователь',
        'referrals_count': 'Количество рефералов',
        'active_withdrawals': 'Активные заявки на вывод',
        'completed_withdrawals': 'Завершенные заявки на вывод'
    }

    def scaffold_list_columns(self):
        columns = super(UserAdmin, self).scaffold_list_columns()
        columns.extend(['referrals_count', 'active_withdrawals', 'completed_withdrawals'])
        return columns

class TaskAdmin(SecureModelView):
    column_list = ('id', 'title', 'reward', 'channel_link')
    form_columns = ('title', 'reward', 'channel_link')
    column_labels = {
        'id': 'ID',
        'title': 'Название',
        'reward': 'Награда',
        'channel_link': 'Ссылка на канал'
    }

class UserTaskAdmin(SecureModelView):
    column_list = ('id', 'user', 'task', 'completed', 'completed_at')
    column_filters = ['completed']
    column_labels = {
        'id': 'ID',
        'user': 'Пользователь',
        'task': 'Задание',
        'completed': 'Выполнено',
        'completed_at': 'Дата выполнения'
    }

class TransactionAdmin(SecureModelView):
    column_list = ('id', 'user', 'amount', 'transaction_type', 'status', 'transaction_id', 'created_at', 'completed_at', 'target_balance')
    column_searchable_list = ['user.username', 'transaction_id']
    column_filters = ['transaction_type', 'status', 'created_at', 'completed_at', 'target_balance']

    column_labels = {
        'id': 'ID',
        'user': 'Пользователь',
        'amount': 'Сумма',
        'transaction_type': 'Тип транзакции',
        'status': 'Статус',
        'transaction_id': 'ID транзакции',
        'created_at': 'Дата создания',
        'completed_at': 'Дата завершения',
        'target_balance': 'Целевой баланс'
    }

    def _user_formatter(view, context, model, name):
        return model.user.username if model.user else 'Неизвестно'

    column_formatters = {
        'user': _user_formatter
    }

    column_sortable_list = (('user', 'user.username'), 'amount', 'transaction_type', 'status', 'created_at', 'completed_at', 'target_balance')

class WithdrawalAdmin(SecureModelView):
    column_list = ('id', 'user_relation', 'amount', 'address', 'status', 'created_at', 'completed_at', 'complete')
    column_searchable_list = ['user_relation.username', 'address']
    column_filters = ['status', 'created_at', 'completed_at']

    column_labels = {
        'id': 'ID',
        'user_relation': 'Пользователь',
        'amount': 'Сумма',
        'address': 'Адрес',
        'status': 'Статус',
        'created_at': 'Дата создания',
        'completed_at': 'Дата завершения',
        'complete': 'Действия'
    }

    def _user_formatter(view, context, model, name):
        return model.user_relation.username if model.user_relation else 'Неизвестно'

    def _complete_withdrawal_formatter(view, context, model, name):
        if model.status != 'completed':
            return Markup(f'<a class="btn btn-sm btn-default" href="{url_for(".complete_withdrawal", id=model.id)}">Завершить</a>')
        return ''

    column_formatters = {
        'user_relation': _user_formatter,
        'complete': _complete_withdrawal_formatter
    }

    column_sortable_list = (('user_relation', 'user_relation.username'), 'amount', 'status', 'created_at', 'completed_at')

    @action('complete', 'Завершить вывод', 'Вы уверены, что хотите завершить выбранные выводы?')
    def action_complete(self, ids):
        try:
            query = Withdrawal.query.filter(Withdrawal.id.in_(ids))
            count = 0
            for withdrawal in query.all():
                if withdrawal.status != 'completed':
                    withdrawal.status = 'completed'
                    withdrawal.completed_at = datetime.utcnow()
                    count += 1
            db.session.commit()
            flash(f'{count} выводов было успешно завершено.')
        except Exception as ex:
            if not self.handle_view_exception(ex):
                raise
            flash('Произошла ошибка при завершении выводов.', 'error')

    @expose('/complete-withdrawal/<int:id>')
    def complete_withdrawal(self, id):
        withdrawal = Withdrawal.query.get(id)
        if withdrawal and withdrawal.status != 'completed':
            withdrawal.status = 'completed'
            withdrawal.completed_at = datetime.utcnow()
            db.session.commit()
            flash('Вывод успешно завершен.')
        else:
            flash('Невозможно завершить вывод.', 'error')
        return redirect(url_for('.index_view'))

def setup_admin(app):
    admin = Admin(app, name='Spin2Win Admin', template_mode='bootstrap3', index_view=SecureAdminIndexView(), base_template='admin/custom_master.html')
    admin.add_view(UserAdmin(User, db.session))
    admin.add_view(TaskAdmin(Task, db.session))
    admin.add_view(UserTaskAdmin(UserTask, db.session))
    admin.add_view(TransactionAdmin(Transaction, db.session))
    admin.add_view(WithdrawalAdmin(Withdrawal, db.session, name='Выводы', endpoint='withdrawals'))

    @app.route('/admin')
    def admin_index():
        return redirect(url_for('admin.index'))