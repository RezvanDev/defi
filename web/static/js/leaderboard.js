document.addEventListener('DOMContentLoaded', function() {
    fetchLeaderboardData();
});

function fetchLeaderboardData() {
    axios.get('/get_leaderboard_data')
        .then(function (response) {
            populateLeaderboard(response.data);
        })
        .catch(function (error) {
            console.error('Ошибка при получении данных лидерборда:', error);
            displayErrorMessage();
        });
}

function populateLeaderboard(data) {
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '';

    data.forEach(function(user, index) {
        const li = document.createElement('li');
        li.className = index < 3 ? ['first', 'second', 'third'][index] : 'board_list';
        li.innerHTML = `
            <span>
                <span style="color: ${getColorForPosition(index)}">
                    ${user.position}.
                </span>
                ${user.username}
            </span>
            <p>${user.total_earned}</p>
        `;
        leaderboardList.appendChild(li);
    });
}

function getColorForPosition(index) {
    const colors = [
        'rgba(255, 183, 0, 1)',
        'rgba(120, 182, 206, 1)',
        'rgba(197, 72, 34, 1)'
    ];
    return index < 3 ? colors[index] : 'inherit';
}

function displayErrorMessage() {
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '<li class="error-message">Не удалось загрузить данные лидерборда. Пожалуйста, попробуйте позже.</li>';
}