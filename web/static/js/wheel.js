const spinBtn = document.getElementById('spin-btn');
const resultMessage = document.getElementById('result-message');
const wheelCanvas = document.getElementById('wheel');
const ctx = wheelCanvas.getContext('2d');
wheelCanvas.width = 300;
wheelCanvas.height = 300;
const miniapp_data = Telegram.WebApp.initDataUnsafe;
const segments = 41;
const segmentAngle = (Math.PI * 2) / segments;

let betCount = 0;
let lastBetAmount = 0;
let selectedNumbers = [0, 0, 0, 0];
let currentBet = 0;

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
    return list.splice(randomIndex, 1)[0]
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

function canVibrate() {
    return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.isVersionAtLeast('6.1');
}


function vibrateDevice(type) {
    if (canVibrate()) {
        try {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
            console.log(`Вибрация типа: ${type}`);
        } catch (error) {
            console.error('Ошибка при попытке вибрации:', error);
        }
    } else {
        console.log('Вибрация не поддерживается в этой версии Telegram Web App');
    }
}

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
        ctx.fontWeight = '600';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(wheelNumber, 0, 0);

        ctx.restore();
    }
}

async function spinWheel() {
    if (!isSpinning) {
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
        console.log('Начало вращения');

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
    spinBtn.textContent = 'Крутить';
    decelerateWheel();
}

function validateNumbers() {
    let count = selectedNumbers.filter(num => num !== 0).length;
    let uniqueNumbers = new Set(selectedNumbers.filter(num => num !== 0));

    if (uniqueNumbers.size !== count) {
        showNotification('Ошибка', 'Числа не должны повторяться', 'error');
        return false;
    }

    return count > 0 && count <= 4;
}

spinBtn.addEventListener('click', async () => {
    if (isNaN(currentBet) || currentBet < 1 || currentBet > 100) {
        showNotification('Ошибка', 'Выберите корректную ставку (от 1 до 100$)', 'error');
        return;
    }

    if (!validateNumbers()) {
        showNotification('Ошибка', 'Выберите от 1 до 4 уникальных чисел', 'error');
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
                bet: currentBet
            })
        });

        if (response.ok) {
            const data = await response.json();
            const { token } = data;
            localStorage.setItem('authToken', token);

            if (data.status === "NO") {
                showNotification('Ошибка', 'У вас не хватает средств!', 'error');
                return;
            }
            spinWheel();
        } else {
            showNotification('Ошибка Сервера', 'Невозможно отправить запрос (check_cash response)', 'error');
        }
    } else {
        spinWheel();
    }
});

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

async function highlightResult() {
    const normalizedAngle = (currentAngle + Math.PI / 2) % (Math.PI * 2);
    const resultIndex = Math.floor(((Math.PI * 2) - normalizedAngle) / segmentAngle) % segments;

    const betAmount = currentBet;

    if (isNaN(betAmount) || betAmount < 1 || betAmount > 100) {
        showNotification('Ошибка', 'Выберите корректную ставку (от 1 до 100$)', 'error');
        return;
    }

    const resultNumber = sections[resultIndex];
    const userNumbers = selectedNumbers.filter(num => num !== 0);

    if (userNumbers.includes(resultNumber)) {
        showModal(`${resultNumber}`);
    } else {
        showNotification('Проигрыш', `Результат ${resultNumber}. К сожалению, вы проиграли. Попробуйте снова!`, 'warning');
    }

    let coefficient;
    switch (userNumbers.length) {
        case 1: coefficient = 10.0; break;
        case 2: coefficient = 7.3; break;
        case 3: coefficient = 5; break;
        case 4: coefficient = 3; break;
        default: coefficient = 1;
    }

    if (userNumbers.includes(resultNumber)) {
        const winnings = betAmount * coefficient;

        if (betCount !== 0) {
            const response = await fetch('/auth/win', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userid: miniapp_data.user.id,
                    winnings: winnings
                })
            });

            if (response.ok) {
                const data = await response.json();
                const { token } = data;
                localStorage.setItem('authToken', token);

                if (data.status === "NO") {
                    showNotification('Ошибка', 'Ошибка запроса (win status no)', 'error');
                    return;
                }
            } else {
                showNotification('Серверная Ошибка', 'Запрос не был отправлен (win response)', 'error');
                return;
            }
        }

        modalMessage.innerText = `Ваш выигрыш: ${winnings.toFixed(2)}$`;

        setTimeout(async function() {
            modal.style.display = 'none';
        }, 10000);
    } else {
        modal.style.display = 'none';
    }
}

async function calculateResultNumber() {
    const resultIndex = Math.floor(((Math.PI * 2) - finalResultAngle) / segmentAngle) % segments;
    return sections[resultIndex];
}

window.onclick = async function(event) {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const numberMenu = document.getElementById('number-menu');
    const numberGrid = numberMenu.querySelector('.number-grid');
    const numberSelects = document.querySelectorAll('.number-select');
    let currentSelectIndex = 0;

    const betMenu = document.getElementById('bet-menu');
    const betGrid = betMenu.querySelector('.bet-grid');
    const betSelect = document.querySelector('.bet-select');

    for (let i = 1; i <= 41; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.addEventListener('click', () => selectNumber(i));
        numberGrid.appendChild(button);
    }

    for (let i = 5; i <= 100; i += 5) {
        const button = document.createElement('button');
        button.textContent = i + '$';
        button.addEventListener('click', () => selectBet(i));
        betGrid.appendChild(button);
    }

    numberSelects.forEach((select, index) => {
        select.addEventListener('click', () => {
            currentSelectIndex = index;
            numberMenu.style.display = 'block';
            betMenu.style.display = 'none';
        });
    });

    betSelect.addEventListener('click', () => {
        betMenu.style.display = 'block';
        numberMenu.style.display = 'none';
    });

    function selectNumber(num) {
        numberSelects[currentSelectIndex].textContent = num;
        selectedNumbers[currentSelectIndex] = num;
        numberMenu.style.display = 'none';


        const selectedNumbersCount = selectedNumbers.filter(n => n !== 0).length;
        updateCoefficient(selectedNumbersCount);
    }

    function selectBet(amount) {
        betSelect.textContent = amount + '$';
        currentBet = amount;
        betMenu.style.display = 'none';
    }

    document.addEventListener('click', (event) => {
        if (!numberMenu.contains(event.target) && !event.target.classList.contains('number-select')) {
            numberMenu.style.display = 'none';
        }
        if (!betMenu.contains(event.target) && !event.target.classList.contains('bet-select')) {
            betMenu.style.display = 'none';
        }
    });

    updateCoefficient(0);
});

function updateCoefficient(selectedNumbersCount) {
    const coefficients = {1: 10, 2: 7.3, 3: 5, 4: 3};
    const coefficient = coefficients[selectedNumbersCount] || 0;
    const coefficientDisplay = document.getElementById('coefficient-display');
    const currentCoefficientElement = document.getElementById('current-coefficient');

    if (currentCoefficientElement) {
        currentCoefficientElement.textContent = `x${coefficient.toFixed(1)}`;

        if (coefficientDisplay) {
            coefficientDisplay.classList.add('update');

            setTimeout(() => {
                coefficientDisplay.classList.remove('update');
            }, 300); }
    } else {
        console.error('Element with id "current-coefficient" not found');
    }
}


if (window.Telegram && window.Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(function() {

        window.location.href = '/';
    });
}

function updateSelectedNumbers() {
    const selectedNumbersCount = selectedNumbers.filter(n => n !== 0).length;
    updateCoefficient(selectedNumbersCount);
}

numberSelects.forEach((select, index) => {
    select.addEventListener('click', () => {
        currentSelectIndex = index;
        numberMenu.style.display = 'block';
        betMenu.style.display = 'none';
    });

    select.addEventListener('change', updateSelectedNumbers);
});