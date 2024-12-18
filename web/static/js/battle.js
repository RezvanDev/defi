document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const betInput = document.querySelector('.bet-input');
    const modalInput = document.getElementById('modalInput');
    const betButtons = document.querySelectorAll('.bet-button');
    const numKeys = document.querySelectorAll('.num-key');
    const createGameBtn = document.getElementById('createGameBtn');
    const keyboardModal = document.getElementById('keyboardModal');
    const closeKeyboard = document.querySelector('.close-keyboard');
    const confirmAmount = document.querySelector('.confirm-amount');
    let selectedAmount = 0;

    tg.expand();
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        window.location.href = "/game";
    });

    // Открытие модального окна при клике на input
    betInput.addEventListener('click', () => {
        keyboardModal.style.display = 'flex';
        modalInput.value = betInput.value.replace('$', '').trim();
    });

    // Закрытие модального окна
    closeKeyboard.addEventListener('click', () => {
        keyboardModal.style.display = 'none';
    });

    // Закрытие по клику вне модального окна
    window.addEventListener('click', (e) => {
        if (e.target === keyboardModal) {
            keyboardModal.style.display = 'none';
        }
    });

    // Обработка числовой клавиатуры
    numKeys.forEach(key => {
        key.addEventListener('click', function() {
            const currentValue = modalInput.value;
            const keyValue = this.textContent;

            if (keyValue === '←') {
                // Удаление последнего символа
                if (currentValue.length > 0) {
                    modalInput.value = currentValue.slice(0, -1);
                }
            } else if (keyValue === '.') {
                // Добавление десятичной точки
                if (!currentValue.includes('.') && currentValue.length > 0) {
                    modalInput.value = currentValue + '.';
                }
            } else {
                // Добавление цифры
                modalInput.value = currentValue === '' ? keyValue : currentValue + keyValue;
            }
        });
    });

    // Подтверждение суммы
    confirmAmount.addEventListener('click', () => {
        const amount = parseFloat(modalInput.value);
        if (amount && amount > 0) {
            selectedAmount = amount;
            betInput.value = `${amount} $`;
            createGameBtn.disabled = false;
            keyboardModal.style.display = 'none';

            // Сброс активных кнопок быстрых ставок
            betButtons.forEach(btn => btn.classList.remove('active'));
        }
    });

    // Обработка быстрых ставок
    betButtons.forEach(button => {
        button.addEventListener('click', function() {
            const amount = this.textContent.replace('$', '');
            selectedAmount = parseInt(amount);

            betButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            betInput.value = `${selectedAmount} $`;
            createGameBtn.disabled = false;
        });
    });

    // Создание игры
    createGameBtn.addEventListener('click', async () => {
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