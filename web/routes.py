from flask import Blueprint, render_template, jsonify, request, redirect, url_for, flash
from flask_login import current_user, login_required
from .auth import db, Task, UserTask, User, Transaction, USDT_ADDRESS, Withdrawal, Battle, BattleRound
from .coinpayments_config import coinpayments_api
from datetime import datetime, timedelta
import logging
from flask_socketio import SocketIO, emit, join_room, leave_room
import uuid
import traceback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

main_bp = Blueprint("main", __name__)
socketio = SocketIO()

# Хранилище активных игр
active_games = {}


class GameState:
    def __init__(self, battle_id):
        self.battle_id = battle_id
        self.current_round = 1
        self.current_turn = None
        self.scores = {
            'creator': [],
            'opponent': []
        }
        self.battle = None
        self.is_finished = False

    def initialize_battle(self, battle):
        self.battle = battle
        self.current_turn = battle.creator_id

    def switch_turn(self):
        if self.current_turn == self.battle.creator_id:
            self.current_turn = self.battle.opponent_id
        else:
            self.current_turn = self.battle.creator_id
            self.current_round += 1

    def add_score(self, user_id, score):
        if user_id == self.battle.creator_id:
            self.scores['creator'].append(score)
        else:
            self.scores['opponent'].append(score)

    def get_state(self):
        return {
            'current_round': self.current_round,
            'current_turn': self.current_turn,
            'scores': self.scores,
            'is_finished': self.is_finished,
            'creator_id': self.battle.creator_id,
            'opponent_id': self.battle.opponent_id
        }



@socketio.on('connect')
def handle_connect():
    if not current_user.is_authenticated:
        return False


@socketio.on('join_game')
def handle_join_game(data):
    battle_id = data.get('battle_id')
    if not battle_id:
        return

    battle = Battle.query.get(battle_id)
    if not battle or battle.status != 'in_progress':
        emit('error', {'message': 'Игра не найдена или неактивна'})
        return

    if current_user.id not in [battle.creator_id, battle.opponent_id]:
        emit('error', {'message': 'Вы не являетесь участником этой игры'})
        return

    if battle_id not in active_games:
        game_state = GameState(battle_id)
        game_state.initialize_battle(battle)
        active_games[battle_id] = game_state

    join_room(str(battle_id))
    emit('game_state', active_games[battle_id].get_state(), room=str(battle_id))


@socketio.on('spin_result')
def handle_spin_result(data):
    battle_id = data.get('battle_id')
    result = data.get('result')

    if not battle_id or not isinstance(result, (int, float)):
        return

    game_state = active_games.get(battle_id)
    if not game_state:
        emit('error', {'message': 'Игра не найдена'})
        return

    if current_user.id != game_state.current_turn:
        emit('error', {'message': 'Сейчас не ваш ход'})
        return

    game_state.add_score(current_user.id, result)

    battle_round = BattleRound(
        battle_id=battle_id,
        round_number=game_state.current_round,
        creator_score=result if current_user.id == game_state.battle.creator_id else None,
        opponent_score=result if current_user.id == game_state.battle.opponent_id else None
    )
    db.session.add(battle_round)

    game_state.switch_turn()

    if game_state.current_round > 3:
        game_state.is_finished = True
        handle_game_end(battle_id)

    db.session.commit()
    emit('game_state', game_state.get_state(), room=str(battle_id))


def handle_game_end(battle_id):
    game_state = active_games.get(battle_id)
    if not game_state:
        return

    battle = game_state.battle
    creator_total = sum(game_state.scores['creator'])
    opponent_total = sum(game_state.scores['opponent'])

    total_bet = battle.bet_amount * 2
    if creator_total > opponent_total:
        winner_id = battle.creator_id
    else:
        winner_id = battle.opponent_id

    winner = User.query.get(winner_id)
    winner.cash += total_bet

    battle.status = 'completed'
    db.session.commit()

    emit('game_end', {
        'creator_total': creator_total,
        'opponent_total': opponent_total,
        'winner_id': winner_id,
        'total_bet': total_bet
    }, room=str(battle_id))

    del active_games[battle_id]

@main_bp.route("/")
def index():
    return render_template("index.html", title="Spin2Win")

@main_bp.route("/friends")
@login_required
def friends():
    return render_template("friends.html", title="Друзья и Рефералы")

@main_bp.route("/tasks")
@login_required
def tasks():
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

    return render_template("tasks.html", title="Задания", tasks=tasks_data)

@main_bp.route("/leaderboard")
def leaderboard():
    return render_template("leaderboard.html", title="Таблица лидеров")

@main_bp.route("/wallet")
@login_required
def wallet():
    pending_deposits = Transaction.query.filter_by(user_id=current_user.id, transaction_type="deposit", status="pending").all()
    return render_template("wallet.html", title="Кошелек", pending_deposits=pending_deposits, usdt_address=USDT_ADDRESS)

@main_bp.route("/game")
@login_required
def game():
    return render_template("game.html", title="Игра")

@main_bp.route("/history")
@login_required
def history():
    return render_template("history.html", title="История")


@main_bp.route("/cooperation")
def cooperation():
    return render_template("cooperation.html", title="Сотрудничество")

@main_bp.route("/wheel")
@login_required
def wheel():
    return render_template("wheel.html", title="Игровое колесо")


@main_bp.route("/get_tasks_status")
@login_required
def get_tasks_status():
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

@main_bp.route("/get_leaderboard_data")
def get_leaderboard_data():
    top_users = User.query.order_by(User.total_earned.desc()).limit(11).all()

    leaderboard_data = []
    for index, user in enumerate(top_users, start=1):
        leaderboard_data.append({
            "position": index,
            "username": user.username,
            "total_earned": f"${user.total_earned:,.0f}"
        })

    return jsonify(leaderboard_data)

@main_bp.route("/deposit", methods=['GET', 'POST'])
@login_required
def deposit():
    if request.method == 'GET':
        return render_template("deposit.html", title="Пополнение баланса")
    elif request.method == 'POST':
        amount = request.json.get("amount")
        if amount is not None:
            try:
                amount = float(amount)
                if amount <= 0:
                    return jsonify({"success": False, "message": "Сумма должна быть больше нуля"})

                buyer_email = "rezvan@icloud.com"

                result = coinpayments_api.create_transaction(
                    amount=amount,
                    currency1='USDT.BEP20',
                    currency2='USDT.BEP20',
                    buyer_email=buyer_email
                )

                if result['error'] == 'ok':
                    new_transaction = Transaction(
                        user_id=current_user.id,
                        amount=amount,
                        transaction_type="deposit",
                        status="pending",
                        transaction_id=result['result']['txn_id'],
                        address=result['result']['address'],
                        target_balance='cash'
                    )
                    db.session.add(new_transaction)
                    db.session.commit()
                    logger.info(f"Created new transaction: {new_transaction}")

                    return jsonify({
                        "success": True,
                        "address": result['result']['address'],
                        "amount": amount,
                        "transaction_id": result['result']['txn_id'],
                        "qr_code": result['result']['qrcode_url']
                    })
                else:
                    return jsonify({"success": False, "message": "Ошибка создания транзакции: " + result['error']})
            except ValueError:
                return jsonify({"success": False, "message": "Неверный формат суммы"})
        else:
            return jsonify({"success": False, "message": "Сумма не указана"})

@main_bp.route("/check_deposits", methods=["POST"])
@login_required
def check_deposits():
    pending_deposits = Transaction.query.filter_by(user_id=current_user.id, transaction_type="deposit", status="pending").all()

    for deposit in pending_deposits:
        result = coinpayments_api.get_tx_info(txid=deposit.transaction_id)
        if result['error'] == 'ok' and int(result['result']['status']) >= 100:
            deposit.status = "completed"
            current_user.cash += deposit.amount

            if current_user.referrer:
                bonus = deposit.amount * 0.05
                current_user.referrer.referral_earnings += bonus
                current_user.referrer.cash += bonus

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Депозиты проверены и обработаны",
        "new_balance": current_user.cash
    })


@main_bp.route("/ipn_handler", methods=['POST'])
def ipn_handler():
    try:
        logger.info("=== IPN REQUEST RECEIVED ===")
        logger.info(f"Raw request data: {request.get_data()}")
        logger.info(f"Form data: {dict(request.form)}")
        logger.info(f"Headers: {dict(request.headers)}")

        # Проверяем HMAC подпись
        if not coinpayments_api.verify_ipn(request.form):
            logger.error("Invalid IPN signature")
            return "Invalid IPN", 400

        # Получаем данные транзакции
        txn_id = request.form.get('txn_id')
        status = int(request.form.get('status', -1))
        amount = float(request.form.get('amount1', 0))
        currency = request.form.get('currency1', '')

        logger.info(f"Processing transaction: {txn_id}, status: {status}, amount: {amount} {currency}")

        # Находим транзакцию в базе
        transaction = Transaction.query.filter_by(transaction_id=txn_id).first()
        if not transaction:
            logger.error(f"Transaction {txn_id} not found in database")
            return "Transaction not found", 404

        # Обновляем статус если платеж подтвержден
        if transaction.status != 'completed' and status >= 100:
            logger.info("Updating transaction status to completed")
            transaction.status = 'completed'
            transaction.completed_at = datetime.utcnow()

            # Обновляем баланс пользователя
            user = transaction.user
            user.cash += amount

            # Начисляем реферальный бонус если есть реферер
            if user.referrer:
                bonus = amount * 0.05  # 5% реферальный бонус
                user.referrer.referral_earnings += bonus
                user.referrer.cash += bonus
                logger.info(f"Added referral bonus {bonus} to user {user.referrer.id}")

            db.session.commit()
            logger.info(f"Successfully processed payment for user {user.id}")

        return "IPN Processed", 200

    except Exception as e:
        logger.error(f"Error processing IPN: {str(e)}")
        traceback.print_exc()
        return "IPN Error", 500

@main_bp.route("/profile")
@login_required
def profile():
    return render_template("profile.html", title="Профиль пользователя")

@main_bp.route("/update_profile", methods=["POST"])
@login_required
def update_profile():
    return redirect(url_for("main.profile"))


@main_bp.route("/withdraw", methods=['GET', 'POST'])
@login_required
def withdraw():
    if request.method == 'GET':
        return render_template("withdraw.html", title="Вывод средств",
                               withdrawal_balance=current_user.withdrawal_balance)
    elif request.method == 'POST':
        amount = request.json.get("amount")
        address = request.json.get("address")
        if amount is not None and address:
            try:
                amount = float(amount)
                if amount <= 0:
                    return jsonify({"success": False, "message": "Сумма должна быть больше нуля"})
                if amount > current_user.withdrawal_balance:
                    return jsonify({"success": False, "message": "Недостаточно средств для вывода"})

                new_withdrawal = Withdrawal(
                    user_id=current_user.id,
                    amount=amount,
                    address=address,
                    status="pending"
                )
                db.session.add(new_withdrawal)
                current_user.withdrawal_balance -= amount
                db.session.commit()

                return jsonify({
                    "success": True,
                    "message": "Запрос на вывод успешно создан",
                    "withdrawal_id": new_withdrawal.id
                })
            except ValueError:
                return jsonify({"success": False, "message": "Неверный формат суммы"})
        else:
            return jsonify({"success": False, "message": "Сумма или адрес не указаны"})


@main_bp.route("/check_deposit/<transaction_id>", methods=["GET"])
@login_required
def check_deposit(transaction_id):
    logger.info(f"Checking deposit for transaction {transaction_id}")
    try:
        result = coinpayments_api.get_tx_info(txid=transaction_id)
        logger.info(f"CoinPayments API response: {result}")
        if result['error'] == 'ok':
            status = int(result['result']['status'])
            logger.info(f"Transaction status: {status}")
            if status >= 100:
                transaction = Transaction.query.filter_by(transaction_id=transaction_id).first()
                logger.info(f"Found transaction in database: {transaction}")
                if transaction and transaction.status != 'completed':
                    transaction.status = 'completed'
                    transaction.completed_at = datetime.utcnow()
                    current_user.cash += transaction.amount
                    db.session.commit()
                    logger.info(f"Updated transaction status to completed and added {transaction.amount} to user balance")
                return jsonify({"success": True, "status": "completed", "amount": transaction.amount})
            else:
                return jsonify({"success": True, "status": "pending"})
        else:
            logger.error(f"Error from CoinPayments API: {result['error']}")
            return jsonify({"success": False, "message": "Ошибка проверки транзакции: " + result['error']})
    except Exception as e:
        logger.error(f"Error checking deposit: {str(e)}", exc_info=True)
        return jsonify({"success": False, "message": f"Произошла ошибка: {str(e)}"})

@main_bp.route("/battle/create")
@login_required
def battle_create():
    return render_template(
        "battle_create.html",
        title="Создать баттл",
        coins=current_user.cash
    )


@main_bp.route("/battle/create/new", methods=['POST'])
@login_required
def create_new_battle():
    try:
        amount = float(request.json.get('amount', 0))
        logger.info(f"Creating battle with amount: {amount}")

        if amount <= 0:
            return jsonify({
                'success': False,
                'message': 'Неверная сумма ставки'
            })

        if amount > current_user.cash:
            return jsonify({
                'success': False,
                'message': 'Недостаточно средств'
            })

        battle = Battle(
            creator_id=current_user.id,
            bet_amount=amount
        )

        current_user.cash -= amount

        db.session.add(battle)
        db.session.commit()
        logger.info(f"Battle created with ID: {battle.id}")

        return jsonify({
            'success': True,
            'battle_id': battle.id,
            'redirect_url': f'/battle/wait/{battle.id}'
        })

    except Exception as e:
        logger.error(f"Error creating battle: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Произошла ошибка при создании игры'
        })

@main_bp.route("/battle/wait/<int:battle_id>")
@login_required
def battle_wait(battle_id):
    try:
        battle = Battle.query.get_or_404(battle_id)

        if battle.creator_id != current_user.id:
            return redirect(url_for('main.game'))


        bot_username = "Spin2Win_react_bot"
        battle_link = f"https://t.me/{bot_username}?start=battle_{battle_id}"

        return render_template(
            "battle_wait.html",
            title="Новый баттл",
            bet_amount=battle.bet_amount,
            battle_link=battle_link,
            battle_id=battle_id
        )
    except Exception as e:
        logger.error(f"Error in battle wait: {str(e)}")
        return redirect(url_for('main.game'))

@main_bp.route("/battle/cancel/<int:battle_id>", methods=['POST'])
@login_required
def cancel_battle(battle_id):
    try:
        battle = Battle.query.get_or_404(battle_id)
        if battle.creator_id == current_user.id and battle.status == 'created':
            creator = User.query.get(battle.creator_id)
            creator.cash += battle.bet_amount
            battle.status = 'cancelled'
            db.session.commit()
            return jsonify({'success': True})
        return jsonify({'success': False, 'message': 'Невозможно отменить игру'})
    except Exception as e:
        logger.error(f"Error canceling battle: {str(e)}")
        return jsonify({'success': False, 'message': 'Ошибка отмены игры'})

@main_bp.route("/battle/status/<int:battle_id>", methods=['GET'])
@login_required
def battle_status(battle_id):
    try:
        battle = Battle.query.get_or_404(battle_id)
        return jsonify({
            'success': True,
            'opponent_joined': battle.opponent_id is not None,
            'status': battle.status
        })
    except Exception as e:
        logger.error(f"Error checking battle status: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Ошибка проверки статуса игры'
        })

@main_bp.route("/battle/join/<int:battle_id>")
@login_required
def battle_join(battle_id):
    try:
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login', next=request.url))

        battle = db.session.get(Battle, battle_id)
        if not battle:
            flash('Игра не найдена', 'error')
            return redirect(url_for('main.game'))

        if not battle.can_join():
            if datetime.utcnow() >= battle.expires_at:
                flash('Время ожидания для этой игры истекло', 'error')
            elif battle.opponent_id is not None:
                flash('К игре уже присоединился другой игрок', 'error')
            else:
                flash('Эта игра уже неактивна', 'error')
            return redirect(url_for('main.game'))

        if battle.creator_id == current_user.id:
            flash('Вы не можете присоединиться к своей игре', 'error')
            return redirect(url_for('main.game'))

        if current_user.cash < battle.bet_amount:
            flash('Недостаточно средств для участия', 'error')
            return redirect(url_for('main.game'))

        return render_template(
            'battle_join.html',
            battle=battle,
            title="Присоединиться к игре"
        )

    except Exception as e:
        logger.error(f"Error in battle join: {str(e)}")
        return redirect(url_for('main.game'))

@main_bp.route("/battle/join/<int:battle_id>/confirm", methods=['POST'])
@login_required
def battle_join_confirm(battle_id):
    try:
        battle = db.session.get(Battle, battle_id)
        if not battle:
            return jsonify({
                'success': False,
                'message': 'Игра не найдена'
            })

        if not battle.can_join():
            if datetime.utcnow() >= battle.expires_at:
                message = 'Время ожидания для этой игры истекло'
            elif battle.opponent_id is not None:
                message = 'К игре уже присоединился другой игрок'
            else:
                message = 'Эта игра уже неактивна'
            return jsonify({
                'success': False,
                'message': message
            })

        if battle.creator_id == current_user.id:
            return jsonify({
                'success': False,
                'message': 'Вы не можете присоединиться к своей игре'
            })

        if current_user.cash < battle.bet_amount:
            return jsonify({
                'success': False,
                'message': 'Недостаточно средств для участия'
            })

        current_user.cash -= battle.bet_amount


        battle.opponent_id = current_user.id
        battle.status = 'in_progress'

        db.session.commit()

        return jsonify({
            'success': True,
            'redirect_url': url_for('main.battle_game', battle_id=battle_id)
        })

    except Exception as e:
        logger.error(f"Error in battle join confirm: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Произошла ошибка при присоединении к игре'
        })


@main_bp.route("/battle/game/<int:battle_id>")
@login_required
def battle_game(battle_id):
    try:
        battle = Battle.query.get_or_404(battle_id)

        if current_user.id not in [battle.creator_id, battle.opponent_id]:
            return redirect(url_for('main.game'))

        if battle.status != 'in_progress':
            return redirect(url_for('main.game'))

        is_creator = current_user.id == battle.creator_id


        creator = User.query.get(battle.creator_id)
        opponent = User.query.get(battle.opponent_id)

        logger.info(f"Rendering battle game page. Battle ID: {battle_id}, Is Creator: {is_creator}")

        return render_template(
            "battle_game.html",
            title="Баттл",
            battle=battle,
            battle_id=battle_id,
            is_creator=is_creator,
            creator_nickname=creator.username,
            opponent_nickname=opponent.username
        )
    except Exception as e:
        logger.error(f"Error in battle game: {e}")
        return redirect(url_for('main.game'))


@main_bp.route("/battle/<int:battle_id>/spin", methods=['POST'])
@login_required
def battle_spin(battle_id):
    try:
        battle = Battle.query.get_or_404(battle_id)

        if current_user.id not in [battle.creator_id, battle.opponent_id]:
            return jsonify({
                'success': False,
                'message': 'Вы не являетесь участником этой игры'
            }), 403

        if battle.status != 'in_progress':
            return jsonify({
                'success': False,
                'message': 'Игра не активна'
            }), 400

        result = request.json.get('result')
        if not isinstance(result, (int, float)):
            return jsonify({
                'success': False,
                'message': 'Неверный формат результата'
            }), 400

        current_round = BattleRound.query.filter_by(
            battle_id=battle_id,
            creator_score=None if current_user.id == battle.creator_id else None
        ).first()

        if not current_round:
            current_round = BattleRound(
                battle_id=battle_id,
                round_number=len(battle.rounds) + 1
            )
            db.session.add(current_round)

        if current_user.id == battle.creator_id:
            current_round.creator_score = result
        else:
            current_round.opponent_score = result

        db.session.commit()

        is_finished = len(battle.rounds) >= 3 and all(
            round.creator_score is not None and round.opponent_score is not None
            for round in battle.rounds
        )

        if is_finished:
            creator_total = sum(round.creator_score or 0 for round in battle.rounds)
            opponent_total = sum(round.opponent_score or 0 for round in battle.rounds)

            winner_id = battle.creator_id if creator_total > opponent_total else battle.opponent_id
            winner = User.query.get(winner_id)
            winner.cash += battle.bet_amount * 2

            battle.status = 'completed'
            db.session.commit()

        game_state = {
            'scores': {
                'creator': [round.creator_score for round in battle.rounds if round.creator_score is not None],
                'opponent': [round.opponent_score for round in battle.rounds if round.opponent_score is not None]
            },
            'current_round': len(battle.rounds),
            'is_creator_turn': current_user.id != battle.creator_id,
            'is_finished': is_finished
        }

        return jsonify({
            'success': True,
            'game_state': game_state
        })

    except Exception as e:
        logger.error(f"Error in battle spin: {e}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Произошла ошибка при сохранении результата'
        }), 500


@main_bp.route("/battle/<int:battle_id>/state")
@login_required
def battle_state(battle_id):
    try:
        battle = Battle.query.get_or_404(battle_id)

        if current_user.id not in [battle.creator_id, battle.opponent_id]:
            return jsonify({
                'success': False,
                'message': 'Вы не являетесь участником этой игры'
            }), 403

        if battle.status != 'in_progress':
            return jsonify({
                'success': False,
                'message': 'Игра не активна'
            }), 400


        creator = User.query.get(battle.creator_id)
        opponent = User.query.get(battle.opponent_id)

        last_round = battle.rounds[-1] if battle.rounds else None
        is_creator_turn = True

        if last_round:
            if last_round.creator_score is None:
                is_creator_turn = True
            elif last_round.opponent_score is None:
                is_creator_turn = False
            else:
                is_creator_turn = True

        is_finished = len(battle.rounds) >= 3 and all(
            round.creator_score is not None and round.opponent_score is not None
            for round in battle.rounds
        )

        game_state = {
            'scores': {
                'creator': [round.creator_score for round in battle.rounds if round.creator_score is not None],
                'opponent': [round.opponent_score for round in battle.rounds if round.opponent_score is not None]
            },
            'current_round': len(battle.rounds),
            'is_creator_turn': is_creator_turn,
            'is_finished': is_finished,
            'status': battle.status,
            'creator_nickname': creator.username,
            'opponent_nickname': opponent.username
        }

        if is_finished:
            creator_total = sum(round.creator_score or 0 for round in battle.rounds)
            opponent_total = sum(round.opponent_score or 0 for round in battle.rounds)
            game_state['totals'] = {
                'creator': creator_total,
                'opponent': opponent_total
            }

        return jsonify({
            'success': True,
            'game_state': game_state
        })

    except Exception as e:
        logger.error(f"Error in battle state: {e}")
        return jsonify({
            'success': False,
            'message': 'Произошла ошибка при получении состояния игры'
        }), 500


@main_bp.route("/transfer")
@login_required
def transfer():
    return render_template("transfer.html", title="Перевод баланса")


@main_bp.route("/transfer_balance", methods=['POST'])
@login_required
def transfer_balance():
    try:
        amount = float(request.json.get('amount', 0))

        if amount <= 0:
            return jsonify({
                'success': False,
                'message': 'Неверная сумма перевода'
            })

        if amount > current_user.withdrawal_balance:
            return jsonify({
                'success': False,
                'message': 'Недостаточно средств для перевода'
            })

        #запись о переводе в транзакциях
        transfer = Transaction(
            user_id=current_user.id,
            amount=amount,
            transaction_type='transfer',
            status='completed',
            transaction_id=str(uuid.uuid4()),
            completed_at=datetime.utcnow(),
            target_balance='cash'
        )

        current_user.withdrawal_balance -= amount
        current_user.cash += amount

        db.session.add(transfer)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Средства успешно переведены'
        })

    except Exception as e:
        logger.error(f"Error in transfer_balance: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Произошла ошибка при переводе средств'
        })

@main_bp.route("/battle/<int:battle_id>/claim_win", methods=['POST'])
@login_required
def claim_battle_win(battle_id):
    try:
        battle = Battle.query.get_or_404(battle_id)

        if battle.status != 'completed':
            creator_total = sum(round.creator_score or 0 for round in battle.rounds)
            opponent_total = sum(round.opponent_score or 0 for round in battle.rounds)

            winner_id = battle.creator_id if creator_total > opponent_total else battle.opponent_id

            if current_user.id == winner_id:
                total_bet = battle.bet_amount * 2
                commission = total_bet * 0.05  # 10% комиссия
                win_amount = total_bet - commission

                current_user.cash += win_amount
                battle.status = 'completed'
                db.session.commit()

                return jsonify({
                    'success': True,
                    'message': 'Выигрыш успешно получен',
                    'amount': win_amount,
                    'commission': commission
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'Вы не являетесь победителем'
                })
        else:
            return jsonify({
                'success': False,
                'message': 'Награда уже была получена'
            })

    except Exception as e:
        logger.error(f"Error in claim battle win: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Произошла ошибка при получении выигрыша'
        })


