// Инициализация табов
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        button.classList.add('active');
        const tabId = button.dataset.tab;
        document.getElementById(tabId).classList.add('active');
    });
});

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Создание элемента истории пополнений
function createDepositItem(deposit) {
    const template = document.getElementById('deposit-template');
    const item = template.content.cloneNode(true);

    item.querySelector('.history-item__date').textContent = formatDate(deposit.created_at);
    item.querySelector('.history-item__amount').textContent = `$${deposit.amount.toFixed(2)}`;

    const statusElement = item.querySelector('.history-item__status');
    statusElement.textContent = deposit.status === 'completed' ? 'Выполнено' : 'В обработке';
    statusElement.classList.add(deposit.status === 'completed' ? 'success' : 'pending');

    return item;
}

// Создание элемента истории спинов
function createSpinItem(spin) {
    const template = document.getElementById('spin-template');
    const item = template.content.cloneNode(true);

    item.querySelector('.history-item__type').textContent = spin.used_freespin ? 'Фриспин' : 'Спин';
    item.querySelector('.history-item__date').textContent = formatDate(spin.created_at);
    item.querySelector('.history-item__numbers').textContent = `Числа: ${spin.selected_numbers.join(', ')}`;
    item.querySelector('.history-item__result').textContent = `Выпало: ${spin.result_number}`;

    const amountElement = item.querySelector('.history-item__amount');
    amountElement.textContent = `${spin.win_amount > 0 ? '+' : ''}$${spin.win_amount.toFixed(2)}`;
    amountElement.classList.add(spin.win_amount > 0 ? 'win' : 'loss');

    return item;
}

// Загрузка и отображение истории
async function loadHistory() {
    try {
        const [depositsResponse, spinsResponse] = await Promise.all([
            fetch('/api/history/deposits'),
            fetch('/api/history/spins')
        ]);

        const deposits = await depositsResponse.json();
        const spins = await spinsResponse.json();

        const depositsList = document.getElementById('deposits-list');
        const spinsList = document.getElementById('spins-list');

        // Очистка контейнеров
        depositsList.innerHTML = '';
        spinsList.innerHTML = '';

        // Отображение пополнений
        if (deposits.length) {
            deposits.forEach(deposit => {
                depositsList.appendChild(createDepositItem(deposit));
            });
        } else {
            depositsList.innerHTML = '<div class="empty-state"><p>История пополнений пуста</p></div>';
        }

        // Отображение спинов
        if (spins.length) {
            spins.forEach(spin => {
                spinsList.appendChild(createSpinItem(spin));
            });
        } else {
            spinsList.innerHTML = '<div class="empty-state"><p>История спинов пуста</p></div>';
        }
    } catch (error) {
        console.error('Error loading history:', error);
        document.querySelectorAll('.history-list').forEach(list => {
            list.innerHTML = '<div class="empty-state"><p>Ошибка загрузки истории</p></div>';
        });
    }
}

// Загрузка истории при загрузке страницы
document.addEventListener('DOMContentLoaded', loadHistory);