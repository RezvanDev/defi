document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const joinButton = document.getElementById('joinButton');

    tg.expand();
    tg.enableClosingConfirmation();

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


    tg.BackButton.onClick(() => {
        window.location.href = '/game';
    });


    tg.BackButton.show();
});