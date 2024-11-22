document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const copyBtn = document.getElementById('copyBtn');
    const shareButton = document.getElementById('shareButton');
    const battleLink = document.getElementById('battleLink');


    tg.expand();
    tg.enableClosingConfirmation();


    copyBtn.addEventListener('click', function() {
        battleLink.select();
        document.execCommand('copy');


        this.style.backgroundColor = 'var(--primary-color)';
        setTimeout(() => {
            this.style.backgroundColor = '';
        }, 200);
    });


    shareButton.addEventListener('click', function() {
        const battleMessage = encodeURIComponent(
            "🎮 Присоединяйся к баттлу!\n\n" +
            `💰 Ставка: ${window.battleData.bet} $\n` +
            "🎲 Игра в режиме 1 на 1\n\n" +
            "🔥 Кто победит - забирает всё!"
        );

        const link = encodeURIComponent(battleLink.value);
        const telegramShareUrl = `https://t.me/share/url?url=${link}&text=${battleMessage}`;


        window.open(telegramShareUrl, '_blank');
    });

    // Таймер
    let timeLeft = 60;
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `00:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeout();
            return;
        }
        timeLeft--;
    }

    const timerInterval = setInterval(updateTimer, 1000);

    // Проверка статуса игры
    async function checkGameStatus() {
        try {
            const response = await fetch(`/battle/status/${window.battleData.id}`);
            const data = await response.json();

            if (data.opponent_joined) {
                clearInterval(statusInterval);
                clearInterval(timerInterval);
                window.location.href = `/battle/game/${window.battleData.id}`;
            }
        } catch (error) {
            console.error('Ошибка при проверке статуса игры:', error);
        }
    }

    async function handleTimeout() {
        try {
            const response = await fetch(`/battle/cancel/${window.battleData.id}`, { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                window.location.href = '/game';
            }
        } catch (error) {
            console.error('Ошибка при отмене игры:', error);
        }
    }

    const statusInterval = setInterval(checkGameStatus, 3000);


    window.addEventListener('beforeunload', () => {
        clearInterval(timerInterval);
        clearInterval(statusInterval);
    });


    tg.BackButton.onClick(() => {
        window.location.href = '/game';
    });


    tg.BackButton.show();
});