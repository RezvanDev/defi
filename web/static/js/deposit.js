document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const createDepositBtn = document.getElementById('createDeposit');
    const depositForm = document.querySelector('.deposit-form');
    const depositInfo = document.getElementById('depositInfo');


    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        window.location.href = '/wallet';
    });

    createDepositBtn.addEventListener('click', function() {
        const amount = document.getElementById('depositAmount').value;

        fetch('/deposit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({amount: amount}),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                depositForm.style.display = 'none';
                depositInfo.style.display = 'block';
                document.getElementById('amountToSend').textContent = data.amount;
                document.getElementById('depositAddress').value = data.address;

                generateQRCode(data.address, data.amount);
                checkDepositStatus(data.transaction_id);
            } else {
                alert(data.message);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Произошла ошибка при создании депозита');
        });
    });

    function checkDepositStatus(transactionId) {
        const checkInterval = setInterval(() => {
            fetch(`/check_deposit/${transactionId}`)
            .then(response => response.json())
            .then(data => {
                console.log("Deposit check response:", data);
                if (data.success && data.status === 'completed') {
                    clearInterval(checkInterval);
                    alert(`Депозит на сумму ${data.amount} USDT успешно зачислен!`);
                    window.location.href = '/wallet';
                }
            })
            .catch((error) => {
                console.error('Error:', error);
            });
        }, 30000);
    }

    function copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        element.select();
        document.execCommand('copy');
        alert('Скопировано в буфер обмена');
    }

    document.querySelector('[data-clipboard-target="#depositAddress"]').addEventListener('click', function() {
        copyToClipboard('depositAddress');
    });

    function generateQRCode(address, amount) {
        const qrCodeDiv = document.getElementById('qrCode');
        const qrData = `ethereum:${address}?amount=${amount}`;
        new QRCode(qrCodeDiv, {
            text: qrData,
            width: 256,
            height: 256,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    }


    tg.expand();
    tg.enableClosingConfirmation();
});