from flask import Flask
from web.routes import main_bp, socketio
from web.auth import auth_bp, login_manager, db, secretkey
from web.admin import setup_admin
from flask_migrate import Migrate
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

migrate = Migrate()

def create_admin_user():
    from web.auth import User, generate_referral_code
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        try:
            admin = User(
                username='admin',
                telegram_id=0,
                referral_code=generate_referral_code()
            )
            admin.set_password('admin')
            db.session.add(admin)
            db.session.commit()
            logger.info("Администратор успешно создан")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Ошибка при создании администратора: {e}")
    else:
        logger.info("Администратор уже существует")

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.sqlite'
    app.config['SECRET_KEY'] = secretkey
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Инициализация основных расширений
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    # Регистрация блюпринтов
    app.register_blueprint(main_bp, url_prefix="/")
    app.register_blueprint(auth_bp, url_prefix="/auth")

    # Инициализация WebSocket с правильным async_mode
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')

    with app.app_context():
        db.create_all()
        create_admin_user()

    setup_admin(app)

    return app