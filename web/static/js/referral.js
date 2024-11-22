document.addEventListener('DOMContentLoaded', function() {
    loadReferralInfo();

    document.getElementById('inviteButton').addEventListener('click', inviteFriend);


    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.MainButton.hide();
    }
});


function loadReferralInfo() {
    fetch('/auth/referral_info')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            updateReferralList(data.referrals);
            updateTotalEarnings(data.referral_earnings);
        })
        .catch(error => {
            console.error('Error loading referral info:', error);

        });
}

setInterval(loadReferralInfo, 3000);


function updateReferralList(referrals) {
    const referralList = document.getElementById('referralList');
    referralList.innerHTML = '';

    if (referrals && referrals.length > 0) {
        referrals.forEach(referral => {
            const li = document.createElement('li');
            li.className = 'board_list';
            li.innerHTML = `
                <img src="{{ url_for('static', filename='assets/Pfp.png') }}" alt="">
                ${referral.username}
            `;
            referralList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.className = 'board_list';
        li.textContent = 'У вас пока нет рефералов';
        referralList.appendChild(li);
    }
}

function updateTotalEarnings(earnings) {
    document.getElementById('totalEarnings').textContent = earnings.toFixed(2);
}

function inviteFriend() {
    if (window.Telegram && window.Telegram.WebApp) {
        fetch('/auth/get_invite_link')
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(`HTTP error! status: ${response.status}, message: ${err.error || 'Unknown error'}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                const inviteLink = data.invite_link;
                const message = `Присоединяйся к Spin2Win! Вот моя реферальная ссылка: ${inviteLink}`;


                window.Telegram.WebApp.MainButton.setText('Поделиться').show();
                window.Telegram.WebApp.MainButton.onClick(() => {
                    window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(message)}`);
                });
            })
            .catch(error => {
                console.error('Error:', error);
                alert(`Произошла ошибка при получении ссылки приглашения: ${error.message}`);
            });
    } else {
        alert('Эта функция доступна только в Telegram.');
    }
}

function hideMainButton() {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.MainButton.hide();
    }
}