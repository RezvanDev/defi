document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const miniapp_data = tg.initDataUnsafe;
    const joinButton = document.getElementById('joinButton');
    const timerElement = document.getElementById('timer');

    tg.expand();
    tg.enableClosingConfirmation();

    // Функция авторизации
    async function authenticate() {
        try {
            const response = await fetch('/auth/login', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: miniapp_data.user.username,
                    userid: miniapp_data.user.id
                })
            });

            if (response.ok) {
                const { token } = await response.json();
                localStorage.setItem('authToken', token);
                // После успешной авторизации включаем функционал битвы
                enableBattleJoin();
            } else {
                console.error("Error Auth");
                alert('Ошибка авторизации');
            }
        } catch (error) {
            console.error('Auth Error:', error);
            alert('Ошибка при авторизации');
        }
    }

    // Проверяем наличие токена
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        authenticate();
    } else {
        enableBattleJoin();
    }

    function enableBattleJoin() {
        let timeLeft = 60;
        function updateTimer() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                window.location.href = '/game';
                return;
            }
            timeLeft--;
        }

        const timerInterval = setInterval(updateTimer, 1000);

        joinButton.addEventListener('click', async function() {
            try {
                joinButton.disabled = true;

                const response = await fetch(`/battle/join/${window.battleData.id}/confirm`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });

                const data = await response.json();

                if (data.success) {
                    clearInterval(timerInterval);
                    window.location.href = data.redirect_url;
                } else {
                    alert(data.message || 'Произошла ошибка при присоединении к игре');
                    joinButton.disabled = false;
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Произошла ошибка при присоединении к игре');
                joinButton.disabled = false;
            }
        });

        window.addEventListener('beforeunload', () => {
            clearInterval(timerInterval);
        });

        tg.BackButton.onClick(() => {
            clearInterval(timerInterval);
            window.location.href = '/game';
        });

        tg.BackButton.show();
    }
});