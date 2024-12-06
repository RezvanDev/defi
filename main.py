import sys
import asyncio
import logging
from flask_migrate import Migrate
from web import create_app, db
from web.auth import User, Battle
from aiogram import Bot, Dispatcher, types
from aiogram.filters.command import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
import secrets
from werkzeug.security import generate_password_hash
from datetime import datetime

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = create_app()
migrate = Migrate(app, db)

bot = Bot("7560565901:AAEuLc2tAr50-PQsP89CovJFX6CMlqoaLXo")
dp = Dispatcher()

WEBAPP_URL = "http://spin2win2.fun"

@dp.message(Command("start"))
async def start_command(message: types.Message):
    try:
        logger.info(f"Start command received from user {message.from_user.id}")

        command_parts = message.text.split()
        args = command_parts[1] if len(command_parts) > 1 else None

        user_id = message.from_user.id
        username = message.from_user.username or message.from_user.first_name

        with app.app_context():
            user = User.query.filter_by(telegram_id=user_id).first()
            if not user:
                referrer = None
                if args and not args.startswith('battle_'):
                    referrer = User.query.filter_by(referral_code=args).first()

                token = secrets.token_urlsafe(16)
                token_hash = generate_password_hash(token)
                referral_code = secrets.token_urlsafe(8)

                user = User(
                    username=username,
                    telegram_id=user_id,
                    token_hash=token_hash,
                    referral_code=referral_code
                )
                if referrer:
                    user.referrer = referrer
                db.session.add(user)
                db.session.commit()

                if referrer:
                    await message.answer(f"Добро пожаловать! Вы были приглашены пользователем {referrer.username}.")
                else:
                    await message.answer("Добро пожаловать в Spin2Win!")
            else:
                await message.answer("С возвращением в Spin2Win!")

            if args and args.startswith('battle_'):
                try:
                    battle_id = int(args.split('_')[1])
                    battle = Battle.query.get(battle_id)

                    if battle and battle.can_join():
                        if battle.creator_id != user.id:
                            join_url = f"{WEBAPP_URL}/battle/join/{battle_id}"
                            battle_keyboard = InlineKeyboardMarkup(inline_keyboard=[
                                [InlineKeyboardButton(
                                    text=f"Присоединиться к игре (Ставка: {battle.bet_amount}$)!",
                                    web_app=types.WebAppInfo(url=join_url)
                                )]
                            ])
                            await message.answer(
                                text=f"🎮 Приглашение в баттл!\n\n"
                                     f"💰 Ставка: {battle.bet_amount}$\n"
                                     f"👤 Создатель: {battle.creator.username}\n"
                                     f"🏆 Выигрыш: {battle.bet_amount * 2}$",
                                reply_markup=battle_keyboard
                            )
                            return
                        else:
                            await message.answer("Вы не можете присоединиться к своей игре.")
                    else:
                        if battle:
                            if datetime.utcnow() >= battle.expires_at:
                                await message.answer("Время ожидания для этой игры истекло.")
                            elif battle.opponent_id is not None:
                                await message.answer("К этой игре уже присоединился другой игрок.")
                            else:
                                await message.answer("Эта игра уже неактивна.")
                        else:
                            await message.answer("Игра не найдена.")
                except Exception as e:
                    logger.error(f"Error processing battle invitation: {e}")
                    await message.answer("Произошла ошибка при обработке приглашения.")


            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="Играть!", web_app=types.WebAppInfo(url=WEBAPP_URL))]
            ])
            await message.answer(
                text="Крути колесо фортуны и выигрывай!",
                reply_markup=keyboard
            )

    except Exception as e:
        logger.error(f"Error in start command: {e}")
        await message.answer("Произошла ошибка. Пожалуйста, попробуйте позже.")


@dp.message(Command("referral"))
async def referral_command(message: types.Message):
    logger.info(f"Referral command received from user {message.from_user.id}")
    try:
        user_id = message.from_user.id

        with app.app_context():
            user = User.query.filter_by(telegram_id=user_id).first()
            if user:
                referral_link = f"https://t.me/{(await bot.get_me()).username}?start={user.referral_code}"
                await message.answer(f"Ваша реферальная ссылка: {referral_link}\n"
                                   f"Количество приглашенных пользователей: {len(user.referrals)}\n"
                                   f"Заработано с рефералов: {user.referral_earnings}")
            else:
                await message.answer("Произошла ошибка. Пожалуйста, попробуйте позже.")
    except Exception as e:
        logger.error(f"Error in referral command: {e}")
        await message.answer("Произошла ошибка. Пожалуйста, попробуйте позже.")


@dp.message()
async def echo(message: types.Message):
    logger.info(f"Received message: {message.text} from user {message.from_user.id}")
    try:
        await message.answer(
            text="Я не понимаю эту команду. Используйте /start для начала игры или /referral для получения информации о вашей реферальной программе.")
        logger.info("Echo message sent successfully")
    except Exception as e:
        logger.error(f"Error sending echo message: {e}")

async def run_bot():
    logger.info("Starting bot")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Error in run_bot: {e}")

def run_flask():
    try:
        app.run(debug=True, host='0.0.0.0', port=5001, use_reloader=False)
    except Exception as e:
        logger.error(f"Error in run_flask: {e}")

async def main():
    try:
        flask_task = asyncio.create_task(asyncio.to_thread(run_flask))
        bot_task = asyncio.create_task(run_bot())
        await asyncio.gather(flask_task, bot_task)
    except Exception as e:
        logger.error(f"Error in main: {e}")

if __name__ == '__main__':
    try:
        if len(sys.argv) > 1 and sys.argv[1] == 'database':
            with app.app_context():
                db.create_all()
            logger.info("Database created successfully")
            sys.exit(0)
        else:
            logger.info("Starting application")
            asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Application stopped")
    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)