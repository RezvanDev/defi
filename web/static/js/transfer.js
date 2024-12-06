document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const transferInput = document.getElementById('transferInput');
    const modalInput = document.getElementById('modalInput');
    const keyboardModal = document.getElementById('keyboardModal');
    const closeKeyboard = document.querySelector('.close-keyboard');
    const numKeys = document.querySelectorAll('.num-key');
    const confirmAmount = document.querySelector('.confirm-amount');
    const betButtons = document.querySelectorAll('.bet-button');
    const transferBtn = document.getElementById('transferBtn');
    let selectedAmount = 0;


    tg.expand();
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        window.location.href = "/wallet";
    });


    transferInput.addEventListener('click', () => {
        keyboardModal.style.display = 'flex';
        modalInput.value = transferInput.value.replace('$', '').trim();
    });


    closeKeyboard.addEventListener('click', () => {
        keyboardModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === keyboardModal) {
            keyboardModal.style.display = 'none';
        }
    });


    numKeys.forEach(key => {
        key.addEventListener('click', function() {
            const currentValue = modalInput.value;
            const keyValue = this.textContent;

            if (keyValue === '←') {

                if (currentValue.length > 0) {
                    modalInput.value = currentValue.slice(0, -1);
                }
            } else if (keyValue === '.') {

                if (!currentValue.includes('.') && currentValue.length > 0) {
                    modalInput.value = currentValue + '.';
                }
            } else {

                if (currentValue.length < 10) {
                    modalInput.value = currentValue === '' ? keyValue : currentValue + keyValue;
                }
            }


            const amount = parseFloat(modalInput.value);
            confirmAmount.disabled = !amount || amount <= 0;
        });
    });


    confirmAmount.addEventListener('click', () => {
        const amount = parseFloat(modalInput.value);
        if (amount && amount > 0) {
            selectedAmount = amount;
            transferInput.value = `${amount} $`;
            transferBtn.disabled = false;
            keyboardModal.style.display = 'none';


            betButtons.forEach(btn => btn.classList.remove('active'));
        }
    });


    betButtons.forEach(button => {
        button.addEventListener('click', function() {
            const amount = this.textContent.replace('$', '');
            selectedAmount = parseInt(amount);

            betButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            transferInput.value = `${selectedAmount} $`;
            transferBtn.disabled = false;
        });
    });

    // Обработка кнопки перевода
    transferBtn.addEventListener('click', async () => {
        if (selectedAmount <= 0) return;

        try {
            const response = await fetch('/transfer_balance', {
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

                tg.showAlert("Средства успешно переведены", () => {
                    window.location.reload();
                });
            } else {
                tg.showAlert(data.message || 'Произошла ошибка при переводе средств');
            }
        } catch (error) {
            console.error('Error:', error);
            tg.showAlert('Произошла ошибка при переводе средств');
        }
    });


    document.body.addEventListener('touchmove', function(e) {
        if (keyboardModal.style.display === 'flex') {
            e.preventDefault();
        }
    }, { passive: false });


    document.addEventListener('touchend', function(e) {
        e.preventDefault();
        e.target.click();
    }, { passive: false });
});