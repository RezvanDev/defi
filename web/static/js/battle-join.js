document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const joinButton = document.getElementById('joinButton');
    const timerElement = document.getElementById('timer');

    tg.expand();
    tg.enableClosingConfirmation();

    // Добавляем таймер
    let timeLeft = 60;
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            window.location.href = '/game';  // Перенаправляем на главную по истечении времени
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
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                clearInterval(timerInterval);  // Очищаем таймер при успешном присоединении
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
        clearInterval(timerInterval);  // Очищаем таймер при закрытии страницы
    });

    tg.BackButton.onClick(() => {
        clearInterval(timerInterval);  // Очищаем таймер при возврате назад
        window.location.href = '/game';
    });

    tg.BackButton.show();
});