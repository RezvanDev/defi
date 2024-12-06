from web import create_app
from web.auth import db, Task


def add_channels():
    app = create_app()
    with app.app_context():
        if Task.query.count() == 0:
            tasks = [
            ]

            db.session.add_all(tasks)
            db.session.commit()
            print("Каналы успешно добавлены в базу данных.")
        else:
            print("Задания уже существуют в базе данных.")


if __name__ == "__main__":
    add_channels()