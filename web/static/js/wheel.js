// Основные переменные и элементы
const spinBtn = document.getElementById('spin-btn');
const resultMessage = document.getElementById('result-message');
const wheelCanvas = document.getElementById('wheel');
const ctx = wheelCanvas.getContext('2d');
wheelCanvas.width = 300;
wheelCanvas.height = 300;
const miniapp_data = Telegram.WebApp.initDataUnsafe;
const segments = 41;
const segmentAngle = (Math.PI * 2) / segments;

// Переменные состояния игры
let betCount = 0;
let lastBetAmount = 0;
let selectedNumbers = [0, 0, 0, 0];
let currentBet = 0;
let usingFreespins = false;
let freespinsCount = 0;
let freespinCost = 2.5;

// Переменные для колеса
let sections = [];
let currentAngle = 0;
let isSpinning = false;
let spinSpeed = 0.25;
let deceleration = 0.1;
let spinAnimationFrame;
let finalResultAngle;

const colors = [
    '#FF3C00', '#DA2C3A', '#FF0015','#FF3C00',
    '#C69A41', '#DB00FF'
];

// Базовые функции для работы с числами
function full_numbers() {
    let nums = [];
    for (let i = 1; i <= 41; i++) {
        nums.push(i);
    }
    return nums;
}

let numbers = full_numbers();

function getRandomNumber(list) {
    const randomIndex = Math.floor(Math.random() * list.length);
    return list.splice(randomIndex, 1)[0];
}

function generate_sections() {
    let sections_array = [];
    while (sections_array.length < segments) {
        const randomNumber = getRandomNumber(numbers);
        if (!sections_array.includes(randomNumber)) {
            sections_array.push(randomNumber);
        }
    }
    numbers = full_numbers();
    return sections_array;
}

// Функции для работы с фриспинами
async function initializeFreespins() {
    try {
        const response = await fetch('/auth/get_freespins', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userid: miniapp_data.user.id
            })
        });

        if (response.ok) {
            const data = await response.json();
            freespinsCount = data.freespins;
            updateFreespinsDisplay();
            updateModeButtonsState();
        }
    } catch (error) {
        console.error('Error fetching freespins:', error);
    }
}

function updateFreespinsDisplay() {
    const freespinsCounter = document.getElementById('freespinCount');
    if (freespinsCounter) {
        freespinsCounter.textContent = freespinsCount;
    }
}

function updateModeButtonsState() {
    const moneyBtn = document.getElementById('moneyModeBtn');
    const freespinBtn = document.getElementById('freespinModeBtn');
    const betSelect = document.querySelector('.bet-select');
    const quickBetButtons = document.querySelectorAll('.quick-bet-btn');

    if (usingFreespins) {
        moneyBtn?.classList.remove('active');
        freespinBtn?.classList.add('active');
        currentBet = freespinCost;
        if (betSelect) betSelect.textContent = '1 💫';
        quickBetButtons.forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            btn.classList.remove('active');
        });
    } else {
        moneyBtn?.classList.add('active');
        freespinBtn?.classList.remove('active');
        if (betSelect) betSelect.textContent = currentBet + '$';
        quickBetButtons.forEach(btn => {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
    }

    if (freespinsCount <= 0) {
        freespinBtn?.classList.add('disabled');
        if (usingFreespins) {
            usingFreespins = false;
            updateModeButtonsState();
        }
    } else {
        freespinBtn?.classList.remove('disabled');
    }
}

// Вспомогательные функции
function canVibrate() {
    return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.isVersionAtLeast('6.1');
}

function vibrateDevice(type) {
    if (canVibrate()) {
        try {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
        } catch (error) {
            console.error('Ошибка при попытке вибрации:', error);
        }
    }
}

// Функции для уведомлений
async function showNotification(title, message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.innerHTML = `
        <strong>${title}</strong>
        <p>${message}</p>
    `;

    notification.addEventListener('click', () => {
        hideNotification(notification);
    });

    document.getElementById('notification-container').appendChild(notification);

    setTimeout(() => {
        hideNotification(notification);
    }, 2000);
}

async function hideNotification(notification) {
    notification.classList.remove('show');
    notification.classList.add('hide');

    setTimeout(() => {
        notification.remove();
    }, 500);
}

// Функции для работы с колесом
async function drawWheel() {
    const centerX = wheelCanvas.width / 2;
    const centerY = wheelCanvas.height / 2;
    const radius = 140;
    const textRadius = radius * 0.85;

    ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

    for (let i = 0; i < segments; i++) {
        const angleStart = currentAngle + segmentAngle * i;
        const angleEnd = currentAngle + segmentAngle * (i + 1);

        const gradient = ctx.createLinearGradient(centerX, centerY - radius, centerX, centerY + radius);
        const startColor = colors[i % colors.length];
        const endColor = colors[(i + 1) % colors.length];
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, angleStart, angleEnd);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();
        ctx.fillStyle = startColor;
        ctx.fill();

        const wheelNumber = sections[i];
        const midAngle = (angleStart + angleEnd) / 2;
        const textX = centerX + Math.cos(midAngle) * textRadius;
        const textY = centerY + Math.sin(midAngle) * textRadius;

        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = 'white';
        ctx.font = '10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wheelNumber, 0, 0);
        ctx.restore();
    }
}

async function spinWheel() {
    if (!isSpinning) {
        if (usingFreespins) {
            if (freespinsCount <= 0) {
                showNotification('Ошибка', 'У вас нет фриспинов!', 'error');
                return;
            }

            const response = await fetch('/auth/use_freespin', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userid: miniapp_data.user.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === "OK") {
                    freespinsCount--;
                    updateFreespinsDisplay();
                    updateModeButtonsState();
                } else {
                    showNotification('Ошибка', 'Не удалось использовать фриспин', 'error');
                    return;
                }
            } else {
                return;
            }
        }

        isSpinning = true;
        spinBtn.textContent = 'СТОП';

        if (betCount === 4) {
            showNotification('Бонус!', 'Вы получаете бесплатный спин!', 'success');
            currentBet = lastBetAmount;
            betCount = 0;
        } else {
            betCount++;
            lastBetAmount = currentBet;
        }

        vibrateDevice('heavy');
        animateSpin();
    } else {
        isSpinning = false;
        spinBtn.textContent = 'КРУТИТЬ';
        decelerateWheel();
    }
}

async function animateSpin() {
    if (isSpinning) {
        currentAngle += spinSpeed;
        if (currentAngle >= Math.PI * 2) currentAngle -= Math.PI * 2;
        drawWheel();
        vibrateDevice('light');
        spinAnimationFrame = requestAnimationFrame(animateSpin);
    }
}

async function decelerateWheel() {
    let interval = setInterval(() => {
        if (spinSpeed > 0) {
            spinSpeed -= deceleration;
            currentAngle += spinSpeed;
            if (currentAngle >= Math.PI * 2) currentAngle -= Math.PI * 2;
            drawWheel();
            vibrateDevice('medium');
        } else {
            clearInterval(interval);
            spinSpeed = 0.0;
            finalResultAngle = currentAngle;
            drawWheel();
            highlightResult();
            spinSpeed = 0.25;
            vibrateDevice('heavy');
        }
    }, 10);
}

async function stopWheel() {
    cancelAnimationFrame(spinAnimationFrame);
    isSpinning = false;
    spinBtn.textContent = 'КРУТИТЬ';
    decelerateWheel();
}

// Валидация и проверки
function validateNumbers() {
    let count = selectedNumbers.filter(num => num !== 0).length;
    let uniqueNumbers = new Set(selectedNumbers.filter(num => num !== 0));

    if (uniqueNumbers.size !== count) {
        showNotification('Ошибка', 'Числа не должны повторяться', 'error');
        return false;
    }

    return count > 0 && count <= 4;
}

// Обработка нажатия кнопки вращения
spinBtn.addEventListener('click', async () => {
    if (!validateNumbers()) {
        showNotification('Ошибка', 'Выберите от 1 до 4 уникальных чисел', 'error');
        return;
    }

    if (usingFreespins) {
        if (freespinsCount <= 0) {
            showNotification('Ошибка', 'У вас нет фриспинов!', 'error');
            return;
        }
        spinWheel();
    } else {
        if (isNaN(currentBet) || currentBet < 1 || currentBet > 100) {
            showNotification('Ошибка', 'Выберите корректную ставку (от 1 до 100$)', 'error');
            return;
        }

        if (betCount < 4) {
            const response = await fetch('/auth/check_cash', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userid: miniapp_data.user.id,
                    bet: currentBet,
                    using_freespin: false
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === "NO") {
                    showNotification('Ошибка', data.message || 'У вас не хватает средств!', 'error');
                    return;
                }
                spinWheel();
            } else {
                showNotification('Ошибка Сервера', 'Невозможно отправить запрос', 'error');
            }
        } else {
            spinWheel();
        }
    }
});

// Обработка результатов
async function highlightResult() {
    const normalizedAngle = (currentAngle + Math.PI / 2) % (Math.PI * 2);
    const resultIndex = Math.floor(((Math.PI * 2) - normalizedAngle) / segmentAngle) % segments;
    const resultNumber = sections[resultIndex];
    const userNumbers = selectedNumbers.filter(num => num !== 0);

    let coefficient;
    switch (userNumbers.length) {
        case 1: coefficient = 10.0; break;
        case 2: coefficient = 7.3; break;
        case 3: coefficient = 5; break;
        case 4: coefficient = 3; break;
        default: coefficient = 1;
    }

    if (userNumbers.includes(resultNumber)) {
        const winnings = usingFreespins ? currentBet * coefficient : currentBet * coefficient;

        if (!usingFreespins || betCount !== 0) {
            const response = await fetch('/auth/win', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userid: miniapp_data.user.id,
                    winnings: winnings,
                    using_freespin: usingFreespins
                })
            });

            if (!response.ok) {
                showNotification('Ошибка', 'Ошибка при начислении выигрыша', 'error');
                return;
            }
        }

        // Обновляем модальное окно
        const modalContent = document.querySelector('.modals__content');
        if (modalContent) {
            const winInfoDiv = modalContent.querySelector('.modals__win-info');
            if (winInfoDiv) {
                winInfoDiv.innerHTML = `
                    <p class="modals__text">Выпало число ${resultNumber}</p>
                    <p class="modals__text">Ваш ВЫИГРЫШ${usingFreespins ? ' (x1 ФРИСПИН)' : ''}</p>
                    <h1 class="modals__amount" id="modal-message">$${winnings.toFixed(2)}</h1>
                `;
            }
        }

        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.remove('modal--hidden');
            modal.style.display = 'flex';
        }
    } else {
        showNotification('Проигрыш', `Результат ${resultNumber}. К сожалению, вы проиграли. Попробуйте снова!`, 'warning');
    }
}

// Модальное окно
const modal = document.getElementById('modal');
const modalMessage = document.getElementById('modal-message');
const closeModal = document.getElementById('closemodal');

async function showModal(message) {
    modalMessage.textContent = message;
    modal.style.display = 'block';
}

async function closeModalWindow() {
    modal.style.display = 'none';
}

closeModal.addEventListener('click', closeModalWindow);

window.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModalWindow();
    }
});

// Инициализация и обработчики DOM событий
document.addEventListener('DOMContentLoaded', () => {
    const numberMenu = document.getElementById('number-menu');
    const numberGrid = numberMenu.querySelector('.number-grid');
    const numberSelects = document.querySelectorAll('.number-select');
    const quickBetButtons = document.querySelectorAll('.quick-bet-btn');
    const betSelect = document.querySelector('.bet-select');
    const moneyBtn = document.getElementById('moneyModeBtn');
    const freespinBtn = document.getElementById('freespinModeBtn');
    let currentSelectIndex = 0;

    // Инициализация фриспинов
    initializeFreespins();


    moneyBtn?.addEventListener('click', () => {
        if (!usingFreespins) return;
        usingFreespins = false;
        updateModeButtonsState();
    });

    freespinBtn?.addEventListener('click', () => {
        if (usingFreespins || freespinsCount <= 0) return;
        usingFreespins = true;
        updateModeButtonsState();
    });


    quickBetButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (usingFreespins) return;

            quickBetButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const amount = parseInt(button.dataset.amount);
            currentBet = amount;
            betSelect.textContent = amount + '$';

            button.style.transform = 'scale(0.5)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        });
    });


    for (let i = 1; i <= 41; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.addEventListener('click', () => {
            if (!isNumberSelected(i)) {
                selectNumber(i);

                button.classList.add('active');
                setTimeout(() => {
                    button.classList.remove('active');
                    numberMenu.classList.remove('show');
                    setTimeout(() => {
                        numberMenu.style.display = 'none';
                    }, 30);
                }, 20);
            }
        });
        numberGrid.appendChild(button);
    }


    function isNumberSelected(num) {
        return selectedNumbers.includes(num);
    }

    function selectNumber(num) {
        numberSelects[currentSelectIndex].textContent = num;
        selectedNumbers[currentSelectIndex] = num;

        const selectedNumbersCount = selectedNumbers.filter(n => n !== 0).length;
        updateCoefficient(selectedNumbersCount);
        updateNumberButtonsState();
    }

    function updateNumberButtonsState() {
        const buttons = numberGrid.querySelectorAll('button');
        buttons.forEach(button => {
            const number = parseInt(button.textContent);
            if (selectedNumbers.includes(number)) {
                button.setAttribute('data-selected', 'true');
                button.classList.add('selected');
            } else {
                button.removeAttribute('data-selected');
                button.classList.remove('selected');
            }
        });
    }


    numberSelects.forEach((select, index) => {
        select.addEventListener('click', () => {
            currentSelectIndex = index;
            numberMenu.style.display = 'block';
            setTimeout(() => {
                numberMenu.classList.add('show');
            }, 10);
            updateNumberButtonsState();
        });
    });

    document.addEventListener('click', (event) => {
        if (!numberMenu.contains(event.target) &&
            !event.target.classList.contains('number-select')) {
            numberMenu.classList.remove('show');
            setTimeout(() => {
                numberMenu.style.display = 'none';
            }, 300);
        }
    });


    numberMenu.addEventListener('click', (event) => {
        event.stopPropagation();
    });


    updateCoefficient(0);
});


function updateCoefficient(selectedNumbersCount) {
    const coefficients = {1: 10, 2: 7.5, 3: 5.5, 4: 4};
    const coefficient = coefficients[selectedNumbersCount] || 0;
    const coefficientDisplay = document.getElementById('coefficient-display');
    const currentCoefficientElement = document.getElementById('current-coefficient');

    if (currentCoefficientElement) {
        currentCoefficientElement.textContent = `x${coefficient.toFixed(1)}`;
        if (coefficientDisplay) {
            coefficientDisplay.classList.add('update');
            setTimeout(() => {
                coefficientDisplay.classList.remove('update');
            }, 300);
        }
    }
}


if (window.Telegram && window.Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(() => {
        window.location.href = '/game';
    });
}


window.addEventListener('load', function() {
    sections = generate_sections();
    drawWheel();
});


document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        sections = generate_sections();
        drawWheel();
    }
});



