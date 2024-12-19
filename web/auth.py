from flask import Blueprint, jsonify, request, render_template
from flask_login import login_required, login_user, current_user, logout_user, UserMixin, LoginManager
import jwt
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import requests
import string
import random
import uuid
from .coinpayments_config import coinpayments_api


auth_bp = Blueprint("auth", __name__)
secretkey = "236776sd76ds6SJDHSJHHDSJ@@8432472349-sd-s=d=a=d-s++sdsds\\_7s67d67d67s677634bb3r7b378rb-s"
db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = "login"

USDT_ADDRESS = ""



class User(UserMixin, db.Model):
    id = db.Column(db.Integer(), primary_key=True)
    username = db.Column(db.String(128), nullable=False, unique=True)
    cash = db.Column(db.Integer(), nullable=False, default=0)
    withdrawal_balance = db.Column(db.Float(), nullable=False, default=0)
    total_earned = db.Column(db.Integer(), nullable=False, default=0)
    freespins = db.Column(db.Integer(), nullable=False, default=0)
    telegram_id = db.Column(db.Integer(), nullable=False)
    token_hash = db.Column(db.String(128), nullable=False)
    created_on = db.Column(db.DateTime(), default=datetime.utcnow)
    last_daily_reward = db.Column(db.DateTime, nullable=True)
    claimed_daily_rewards = db.Column(db.String(255), default='')
    email = db.Column(db.String(120), unique=True, nullable=True)
    withdrawals = db.relationship('Withdrawal', back_populates='user_relation', lazy=True)

    referrer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    referral_code = db.Column(db.String(10), unique=True, nullable=False)
    referral_earnings = db.Column(db.Float, default=0.0)

    referrals = db.relationship('User', backref=db.backref('referrer', remote_side=[id]))

    def add_cash(self, moneys):
        self.cash += moneys

    def use_freespin(self):
        if self.freespins > 0:
            self.freespins -= 1
            return 2.5  # Стоимость одного фриспина
        return 0

    def set_password(self, password):
        self.token_hash = generate_password_hash(password)

    def check_password_hash(self, password):
        return check_password_hash(self.token_hash, password)

    def __repr__(self):
        return f"<{self.id}:{self.username}>"


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(128), nullable=False)
    reward = db.Column(db.Integer, nullable=False)
    channel_link = db.Column(db.String(256), nullable=False)


class UserTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship('User', backref=db.backref('user_tasks', lazy=True))
    task = db.relationship('Task', backref=db.backref('user_tasks', lazy=True))


User.tasks = db.relationship('Task', secondary='user_task', backref=db.backref('users', lazy=True))


class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    transaction_type = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    transaction_id = db.Column(db.String(36), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    address = db.Column(db.String(128), nullable=True)
    target_balance = db.Column(db.String(20), default='cash')

    user = db.relationship('User', backref=db.backref('transactions', lazy=True))


class Withdrawal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    address = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)


    user_relation = db.relationship('User', back_populates='withdrawals')

    def __repr__(self):
        return f'<Withdrawal {self.id}: {self.amount} for user {self.user_id}>'

    def __repr__(self):
        return f'<Withdrawal {self.id}: {self.amount} for user {self.user_id}>'


class Battle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    opponent_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    bet_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='created')  # created, active, completed, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)


    creator = db.relationship('User', foreign_keys=[creator_id])
    opponent = db.relationship('User', foreign_keys=[opponent_id])

    def __init__(self, creator_id, bet_amount):
        self.creator_id = creator_id
        self.bet_amount = bet_amount
        self.status = 'created'
        self.created_at = datetime.utcnow()
        self.expires_at = self.created_at + timedelta(minutes=1)

    def generate_invite_link(self, base_url):
        return f"{base_url}/battle/join/{self.id}"

    def can_join(self):
        return (self.status == 'created' and
                not self.opponent_id and
                datetime.utcnow() < self.expires_at)


class BattleRound(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    battle_id = db.Column(db.Integer, db.ForeignKey('battle.id'))
    round_number = db.Column(db.Integer)  # 1, 2 или 3
    creator_score = db.Column(db.Integer, nullable=True)
    opponent_score = db.Column(db.Integer, nullable=True)

    battle = db.relationship('Battle', backref='rounds')


@login_manager.user_loader
def load_user(id):
    return db.session.query(User).get(id)


def generate_comment():
    return f"{current_user.id}-{''.join(random.choices(string.ascii_uppercase + string.digits, k=8))}"

def generate_referral_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        if not User.query.filter_by(referral_code=code).first():
            return code


@auth_bp.route("/win", methods=["POST"])
@login_required
def win():
    winnings = float(request.json["winnings"])
    using_freespin = request.json.get("using_freespin", False)

    if using_freespin:
        winnings *= 1.5

    current_user.total_earned += winnings
    current_user.withdrawal_balance += winnings
    db.session.commit()

    return jsonify({
        "status": "OK"
    })


@auth_bp.route("/check_cash", methods=["POST"])
@login_required
def check():
    bet = float(request.json["bet"])
    using_freespin = request.json.get("using_freespin", False)

    if using_freespin:
        if current_user.freespins <= 0:
            return jsonify({
                "status": "NO",
                "message": "У вас нет фриспинов"
            })
        freespin_cost = current_user.use_freespin()
        bet = freespin_cost
    else:
        if current_user.cash < bet:
            return jsonify({
                "status": "NO",
                "message": "У вас не хватает средств"
            })
        current_user.cash -= bet

    db.session.commit()

    return jsonify({
        "status": "OK",
        "cash": current_user.cash,
        "freespins": current_user.freespins
    })


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":

        return render_template(
            "login.html",
            title="Авторизация",
            next_url=request.args.get('next', '')
        )


    if current_user.is_authenticated:
        token = {"user_id": current_user.id, "exp": datetime.utcnow() + timedelta(days=1)}
        return jsonify({"token": token})

    try:
        username = request.json["username"]
        telegram_id = request.json["userid"]
        referral_code = request.json.get("referral_code")
        tokenizer = f"{username}FUCKHACKERS{telegram_id}"

        user = User.query.filter_by(username=username).first()

        if not user:
            user = User(username=username, telegram_id=telegram_id)
            user.set_password(tokenizer)
            user.referral_code = generate_referral_code()

            if referral_code:
                referrer = User.query.filter_by(referral_code=referral_code).first()
                if referrer:
                    user.referrer_id = referrer.id

            db.session.add(user)
            db.session.commit()

        login_user(user)

        # Если есть next параметр в сессии, возвращаем его
        next_url = request.args.get('next', '')
        token = {
            "user_id": user.id,
            "exp": datetime.utcnow() + timedelta(days=1),
            "next_url": next_url if next_url else None
        }
        return jsonify({"token": token})
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"success": False, "message": "Ошибка авторизации"}), 400


@auth_bp.route("/claim_daily_reward", methods=["POST"])
@login_required
def claim_daily_reward():
    day = request.json.get('day')
    current_time = datetime.utcnow()

    claimed_days = [int(d) for d in current_user.claimed_daily_rewards.split(',') if d]

    if current_user.last_daily_reward:
        time_since_last_reward = current_time - current_user.last_daily_reward
        days_passed = time_since_last_reward.days

        if days_passed > 1:
            claimed_days = []
            current_day = 1
        elif days_passed == 0:
            return jsonify({"status": "error", "message": "Вы уже получили награду сегодня"})
        else:
            current_day = len(claimed_days) + 1
    else:
        current_day = 1

    if day != current_day:
        return jsonify({"status": "error", "message": "Можно получить награду только за текущий день"})

    if day in claimed_days:
        return jsonify({"status": "error", "message": "Награда за этот день уже получена"})

    spins_to_add = 1 if day <= 4 else 2
    current_user.freespins += spins_to_add

    claimed_days.append(day)
    current_user.claimed_daily_rewards = ','.join(map(str, claimed_days))
    current_user.last_daily_reward = current_time

    db.session.commit()

    return jsonify({
        "status": "success",
        "free_spins": current_user.freespins,
        "current_day": current_day
    })


@auth_bp.route("/get_daily_rewards_status")
@login_required
def get_daily_rewards_status():
    current_time = datetime.utcnow()
    claimed_days = [int(d) for d in current_user.claimed_daily_rewards.split(',') if d]

    if current_user.last_daily_reward:
        time_since_last_reward = current_time - current_user.last_daily_reward
        days_passed = time_since_last_reward.days

        if days_passed > 1:
            claimed_days = []
            current_day = 1
        else:
            current_day = len(claimed_days) + 1
    else:
        current_day = 1

    return jsonify({
        "current_day": current_day,
        "claimed_days": claimed_days
    })


@auth_bp.route("/get_tasks", methods=["GET"])
@login_required
def get_tasks():
    tasks = Task.query.all()
    user_tasks = UserTask.query.filter_by(user_id=current_user.id).all()
    completed_task_ids = [ut.task_id for ut in user_tasks if ut.completed]

    tasks_data = []
    for task in tasks:
        tasks_data.append({
            'id': task.id,
            'title': task.title,
            'reward': task.reward,
            'channel_link': task.channel_link,
            'completed': task.id in completed_task_ids
        })

    return jsonify({"tasks": tasks_data})


BOT_TOKEN = "7560565901:AAEuLc2tAr50-PQsP89CovJFX6CMlqoaLXo"


def check_subscription(user_id: int, channel_username: str) -> bool:
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember"
    params = {
        "chat_id": f"@{channel_username}",
        "user_id": user_id
    }
    try:
        response = requests.get(url, params=params)
        if response.status_code == 200:
            result = response.json()
            if result.get("ok"):
                status = result["result"]["status"]
                return status in ['member', 'administrator', 'creator']
    except Exception as e:
        print(f"Ошибка при проверке подписки: {e}")
    return False


@auth_bp.route("/check_task", methods=["POST"])
@login_required
def check_task():
    task_id = request.json.get('taskId')
    task = Task.query.get(task_id)

    if not task:
        return jsonify({"success": False, "message": "Задание не найдено"})

    user_task = UserTask.query.filter_by(user_id=current_user.id, task_id=task_id).first()

    if user_task and user_task.completed:
        return jsonify({"success": True, "message": "Задание уже выполнено", "reward": task.reward})

    subscription_success = check_subscription(current_user.telegram_id, task.channel_link.split('/')[-1])

    if subscription_success:
        if not user_task:
            user_task = UserTask(user_id=current_user.id, task_id=task_id)
            db.session.add(user_task)

        user_task.completed = True
        user_task.completed_at = datetime.utcnow()
        current_user.cash += task.reward
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Задание выполнено! Вы получили {task.reward} монет.",
            "reward": task.reward
        })
    else:
        return jsonify({"success": False, "message": "Подписка не подтверждена"})



@auth_bp.route("/referral_info", methods=["GET"])
@login_required
def referral_info():
    referrals = [{"username": user.username} for user in current_user.referrals]
    return jsonify({
        "referral_code": current_user.referral_code,
        "referral_earnings": current_user.referral_earnings,
        "referral_count": len(current_user.referrals),
        "referrals": referrals
    })

@auth_bp.route("/get_invite_link", methods=["GET"])
@login_required
def get_invite_link():

    invite_link = f"https://t.me/Spin2Win_react_bot?start={current_user.referral_code}"
    return jsonify({"invite_link": invite_link})


@auth_bp.route("/create_deposit", methods=["POST"])
@login_required
def create_deposit():
    amount = request.json.get("amount")
    if not amount or float(amount) <= 0:
        return jsonify({"success": False, "message": "Неверная сумма депозита"})

    try:
        result = coinpayments_api.create_transaction(amount=float(amount), currency1='USDT', currency2='USDT',
                                                     buyer_email=current_user.email)

        if result['error'] == 'ok':
            new_transaction = Transaction(
                user_id=current_user.id,
                amount=float(amount),
                transaction_type="deposit",
                status="pending",
                transaction_id=result['result']['txn_id'],
                address=result['result']['address']
            )
            db.session.add(new_transaction)
            db.session.commit()

            return jsonify({
                "success": True,
                "message": "Депозит создан",
                "transaction_id": result['result']['txn_id'],
                "address": result['result']['address'],
                "amount": amount,
                "qr_code": result['result']['qrcode_url']
            })
        else:
            return jsonify({"success": False, "message": "Ошибка создания транзакции: " + result['error']})
    except Exception as e:
        return jsonify({"success": False, "message": f"Произошла ошибка: {str(e)}"})



@auth_bp.route("/deposit_info", methods=["GET"])
@login_required
def deposit_info():
    return jsonify({
        "message": "Для создания депозита используйте метод POST /create_deposit"
    })


@auth_bp.route("/get_freespins", methods=["POST"])
@login_required
def get_freespins():
    return jsonify({
        "status": "OK",
        "freespins": current_user.freespins
    })


@auth_bp.route("/use_freespin", methods=["POST"])
@login_required
def use_freespin():
    if current_user.freespins <= 0:
        return jsonify({
            "status": "NO",
            "message": "У вас нет фриспинов"
        })

    freespin_cost = current_user.use_freespin()
    db.session.commit()

    return jsonify({
        "status": "OK",
        "freespins": current_user.freespins,
        "bet_amount": freespin_cost
    })


