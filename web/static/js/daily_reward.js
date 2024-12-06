document.addEventListener('DOMContentLoaded', function() {
    initializeDailyRewards();
});

function initializeDailyRewards() {
    fetch('/auth/get_daily_rewards_status')
        .then(response => response.json())
        .then(data => {
            const rewardsContainer = document.getElementById('daily-rewards');
            rewardsContainer.innerHTML = '';
            for (let i = 0; i < 10; i++) {
                const li = createDayElement(i + 1, data.current_day, data.claimed_days);
                rewardsContainer.appendChild(li);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}


function createDayElement(day, currentDay, claimedDays) {
    const li = document.createElement('li');
    const dayStatus = getDayStatus(day, currentDay, claimedDays);

    li.innerHTML = `
        <p class="spins_days">День ${day}</p>
        <img src="/static/assets/${dayStatus.image}" alt="" class="spins_img">
        <p class="spins_number" ${dayStatus.textStyle}>${day <= 4 ? '1 спин' : '2 спина'}</p>
    `;

    if (dayStatus.style) {
        Object.assign(li.style, dayStatus.style);
    }

    if (day === currentDay && !claimedDays.includes(day)) {
        li.addEventListener('click', () => claimDailyReward(day));
        li.style.cursor = 'pointer';
    }

    return li;
}

function getDayStatus(day, currentDay, claimedDays) {
    if (claimedDays.includes(day)) {
        return {
            image: 'spins_done.png',
            style: {
                backgroundColor: 'rgba(31, 217, 84, 0.07)',
                borderColor: 'rgba(31, 217, 84, 0.5)'
            },
            textStyle: 'style="color: rgba(31, 217, 84, 1);"'
        };
    } else if (day === currentDay) {
        return {
            image: 'spins_current.png',
            style: {
                backgroundColor: '#FC3F83',
                borderColor: '#FC3F83'
            },
            textStyle: 'style="color: #FFFFFF;"'
        };
    } else {
        return {
            image: 'spin_block.png',
            style: {},
            textStyle: ''
        };
    }
}

function claimDailyReward(day) {
    fetch('/auth/claim_daily_reward', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ day: day })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert(`Вы получили ежедневную награду! У вас теперь ${data.free_spins} бесплатных спинов.`);
            initializeDailyRewards();
        } else {
            alert(data.message || 'Произошла ошибка при получении награды.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Произошла ошибка при получении награды.');
    });
}