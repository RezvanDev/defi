document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const betInput = document.querySelector('.bet-input');
    const betButtons = document.querySelectorAll('.bet-button');
    const createGameBtn = document.getElementById('createGameBtn');
    let selectedAmount = 0;

    tg.expand();

    // Обработка быстрых ставок
    betButtons.forEach(button => {
        button.addEventListener('click', function() {
            const amount = this.textContent.replace('$', '');
            selectedAmount = parseInt(amount);

            // Обновляем UI
            betButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            betInput.value = `${selectedAmount} $`;
            createGameBtn.disabled = false;
        });
    });

    // Создание игры
    createGameBtn.addEventListener('click', async function() {
        if (selectedAmount <= 0) return;

        try {
            const response = await fetch('/battle/create/new', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: selectedAmount
                })
            });

            const data = await response.json();

            if (data.success) {
                // Используем redirect_url из ответа сервера
                window.location.href = data.redirect_url;
            } else {
                alert(data.message || 'Произошла ошибка при создании игры');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Произошла ошибка при создании игры');
        }
    });
});