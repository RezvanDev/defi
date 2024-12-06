document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    const joinButton = document.getElementById('joinButton');

    tg.expand();
    tg.enableClosingConfirmation();


    if (!sessionStorage.getItem('pageReloaded')) {

        sessionStorage.setItem('pageReloaded', 'true');

        setTimeout(function() {
            location.reload();
        }, 1000);
    }

    tg.BackButton.onClick(() => {
        window.location.href = '/';
    });

    tg.BackButton.show();
});