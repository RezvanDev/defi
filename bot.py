import logging
from aiogram import Bot, Dispatcher, types
from aiogram.utils.keyboard import ReplyKeyboardBuilder

logging.basicConfig(level=logging.INFO)

bot = Bot("7651466904:AAHKJ5F_mF_1-VXJD7iHQTC0DdVEHbxrFUo")
dp = Dispatcher()

async def check_subscription(user_id: int, channel_username: str) -> bool:
    try:
        member = await bot.get_chat_member(chat_id=f"@{channel_username}", user_id=user_id)
        return member.status in ['member', 'administrator', 'creator']
    except Exception as e:
        logging.error(f"Ошибка при проверке подписки: {e}")
        return False

async def start_command(message: types.Message):
    webAppInfo = types.WebAppInfo(url="ВСТАВИТЬ URL")
    builder = ReplyKeyboardBuilder()
    builder.add(types.KeyboardButton(text="Вперед!", web_app=webAppInfo))

    await message.answer(
        text="Добро пожаловать в Spin2Win - крути колесо фортуны и выигрывай!",
        reply_markup=builder.as_markup(resize_keyboard=True),
    )



def setup_bot():
    dp.message()(start_command)

async def main():
    setup_bot()
    print("Delete webhooks")
    await bot.delete_webhook(drop_pending_updates=True)
    print("Polling")
    await dp.start_polling(bot)

if __name__ == "__main__":
    import asyncio
    print("Start...")
    asyncio.run(main())