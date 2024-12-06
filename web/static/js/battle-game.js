const tg = window.Telegram.WebApp;

const wheel = document.getElementById("wheel");
const ctx = wheel.getContext("2d");
const spinButton = document.getElementById("spin-button");
const turnStatus = document.querySelector(".turn-status");
const timerDisplay = document.querySelector(".timer");

const battleId = document.body.dataset.battleId;
const isCreator = document.body.dataset.isCreator === "true";
const creatorNickname = document.body.dataset.creatorNickname;
const opponentNickname = document.body.dataset.opponentNickname;

const WHEEL_CONFIG = {
  width: 300,
  height: 300,
  radius: 135,
  numbers: Array.from({ length: 42 }, (_, i) => i + 1),
  colors: ["#6814EB", "#B12BB2", "#F48523", "#AD1D14", "#F62C2C"],
};

let gameState = {
  isSpinning: false,
  currentAngle: 0,
  spinSpeed: 0.25,
  deceleration: 0.1,
  timerSeconds: 117,
  canSpin: false,
  currentRound: 1,
  sections: [],
  spinAnimationFrame: null,
  movesCount: 0
};

wheel.width = WHEEL_CONFIG.width;
wheel.height = WHEEL_CONFIG.height;
const centerX = wheel.width / 2;
const centerY = wheel.height / 2;
const segments = WHEEL_CONFIG.numbers.length;
const segmentAngle = (Math.PI * 2) / segments;

function generateSections() {
  let numbers = [...WHEEL_CONFIG.numbers];
  let sections = [];

  while (sections.length < segments) {
    const randomIndex = Math.floor(Math.random() * numbers.length);
    sections.push(numbers.splice(randomIndex, 1)[0]);
  }

  return sections;
}

function canVibrate() {
  return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.isVersionAtLeast("6.1");
}

function vibrateDevice(type) {
  if (canVibrate()) {
    try {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    } catch (error) {
      console.error("Ошибка вибрации:", error);
    }
  }
}

function drawWheel() {
  ctx.clearRect(0, 0, wheel.width, wheel.height);

  ctx.beginPath();
  ctx.arc(centerX, centerY, WHEEL_CONFIG.radius + 5, 0, Math.PI * 2);
  ctx.strokeStyle = "#D41000";
  ctx.lineWidth = 30;
  ctx.shadowColor = "black";
  ctx.shadowBlur = 1;
  ctx.stroke();

  for (let i = 0; i < segments; i++) {
    const startAngle = gameState.currentAngle + segmentAngle * i;
    const endAngle = startAngle + segmentAngle;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, WHEEL_CONFIG.radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = WHEEL_CONFIG.colors[i % WHEEL_CONFIG.colors.length];
    ctx.fill();

    const midAngle = (startAngle + endAngle) / 2;
    const textRadius = WHEEL_CONFIG.radius * 0.9;
    ctx.save();
    ctx.translate(
      centerX + Math.cos(midAngle) * textRadius,
      centerY + Math.sin(midAngle) * textRadius
    );
    ctx.rotate(midAngle + Math.PI);
    ctx.rotate(Math.PI);
    ctx.fillStyle = "white";
    ctx.font = "14px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(gameState.sections[i].toString(), 0, 0);
    ctx.restore();
  }
}

function animate() {
  if (gameState.isSpinning) {
    gameState.currentAngle += gameState.spinSpeed;
    if (gameState.currentAngle > Math.PI * 2) {
      gameState.currentAngle -= Math.PI * 2;
    }
    drawWheel();
    vibrateDevice("light");
    gameState.spinAnimationFrame = requestAnimationFrame(animate);
  }
}

function decelerate() {
  let interval = setInterval(() => {
    if (gameState.spinSpeed > 0) {
      gameState.spinSpeed -= gameState.deceleration;
      gameState.currentAngle += gameState.spinSpeed;
      if (gameState.currentAngle > Math.PI * 2) {
        gameState.currentAngle -= Math.PI * 2;
      }
      drawWheel();
      vibrateDevice("medium");
    } else {
      clearInterval(interval);
      gameState.spinSpeed = 0;
      const result = getResult();
      saveResult(result);
      gameState.spinSpeed = 0.25;
      vibrateDevice("heavy");
    }
  }, 50);
}

function getResult() {
  const normalizedAngle = (gameState.currentAngle + Math.PI / 2) % (Math.PI * 2);
  const resultIndex = Math.floor((Math.PI * 2 - normalizedAngle) / segmentAngle) % segments;
  return gameState.sections[resultIndex];
}

function saveResult(result) {
  gameState.movesCount++;

  fetch(`/battle/${battleId}/spin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      result,
      round: Math.ceil(gameState.movesCount / 2)
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        window.location.reload();
      }
    });
}

function saveGameResult(isWinner, totalAmount) {
  fetch(`/battle/${battleId}/finish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      is_winner: isWinner,
      amount: totalAmount
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const modalMessage = document.getElementById("modal-message");
        if (modalMessage && isWinner) {
          modalMessage.textContent = `$${totalAmount.toFixed(2)}`;
        }
      }
    })
    .catch(error => {
      console.error("Ошибка при сохранении результата:", error);
    });
}

function startSpin() {
  if (!gameState.canSpin || gameState.isSpinning) return;

  gameState.isSpinning = true;
  spinButton.textContent = "СТОП";
  spinButton.dataset.action = "stop";
  vibrateDevice("heavy");
  animate();
}

function stopSpin() {
  if (!gameState.isSpinning) return;

  gameState.isSpinning = false;
  spinButton.textContent = "КРУТИТЬ";
  spinButton.dataset.action = "spin";
  cancelAnimationFrame(gameState.spinAnimationFrame);
  decelerate();
}

function updateTimer() {
  if (gameState.timerSeconds > 0) {
    gameState.timerSeconds--;
    timerDisplay.textContent = formatTime(gameState.timerSeconds);
    if (gameState.timerSeconds === 0 && gameState.isSpinning) {
      stopSpin();
    }
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function checkGameState() {
  fetch(`/battle/${battleId}/state`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateGameState(data.game_state);
      }
    });
}

function updateGameState(state) {
  const creatorScores = state.scores.creator;
  const opponentScores = state.scores.opponent;

  const totalMoves = creatorScores.filter(score => score !== undefined).length +
                     opponentScores.filter(score => score !== undefined).length;

  gameState.movesCount = totalMoves;
  gameState.currentRound = Math.ceil(totalMoves / 2);

  const isCreatorTurn = totalMoves % 2 === 0;
  const isMyTurn = isCreator ? isCreatorTurn : !isCreatorTurn;
  const canMakeMove = isMyTurn && totalMoves < 6;

  turnStatus.textContent = isMyTurn ? "Ваш ход" : `Ход ${isCreator ? opponentNickname : creatorNickname}`;

  const player1Nickname = document.getElementById('player1-nickname');
  const player2Nickname = document.getElementById('player2-nickname');

  if (isCreator) {
    player1Nickname.textContent = creatorNickname;
    player2Nickname.textContent = opponentNickname;
  } else {
    player1Nickname.textContent = opponentNickname;
    player2Nickname.textContent = creatorNickname;
  }

  gameState.canSpin = canMakeMove;
  spinButton.disabled = !canMakeMove;
  spinButton.classList.toggle("disabled", !canMakeMove);

  const mySlots = isCreator ? "player1" : "player2";
  const opponentSlots = isCreator ? "player2" : "player1";
  const myScores = isCreator ? creatorScores : opponentScores;
  const opponentScores2 = isCreator ? opponentScores : creatorScores;

  for (let i = 0; i < 3; i++) {
    const mySlotElement = document.getElementById(`${mySlots}-round${i + 1}`);
    const opponentSlotElement = document.getElementById(`${opponentSlots}-round${i + 1}`);

    if (mySlotElement) {
      mySlotElement.textContent = myScores[i] !== undefined ? myScores[i] : "+";
    }
    if (opponentSlotElement) {
      opponentSlotElement.textContent = opponentScores2[i] !== undefined ? opponentScores2[i] : "+";
    }
  }

  const isGameComplete = creatorScores.filter(s => s !== undefined).length === 3 &&
                        opponentScores.filter(s => s !== undefined).length === 3;

  if (isGameComplete) {
    const creatorTotal = creatorScores.reduce((sum, score) => sum + (score || 0), 0);
    const opponentTotal = opponentScores.reduce((sum, score) => sum + (score || 0), 0);

    const isWinner = isCreator ?
      creatorTotal > opponentTotal :
      opponentTotal > creatorTotal;

    const totalBet = state.bet_amount * 2;
    const commission = totalBet * 0.1; // 10% комиссия
    const winAmount = totalBet - commission;

    const creatorFinalScore = document.getElementById("creator-final-score");
    const opponentFinalScore = document.getElementById("opponent-final-score");
    const gameResultMessage = document.getElementById("game-result-message");
    const finalCreatorNickname = document.getElementById("final-creator-nickname");
    const finalOpponentNickname = document.getElementById("final-opponent-nickname");
    const resultModal = document.getElementById("result-modal");
    const claimWinButton = document.getElementById("claim-win");
    const closeModalButton = document.getElementById("close-modal");

    if (finalCreatorNickname) finalCreatorNickname.textContent = creatorNickname;
    if (finalOpponentNickname) finalOpponentNickname.textContent = opponentNickname;

    if (creatorFinalScore) creatorFinalScore.textContent = creatorTotal;
    if (opponentFinalScore) opponentFinalScore.textContent = opponentTotal;

    // Обновляем сообщение о результате игры
    if (gameResultMessage) {
      if (isWinner) {
        gameResultMessage.textContent = "Вы победили";
      } else {
        gameResultMessage.textContent = "Вы проиграли";
      }
    }

    if (resultModal) {
      resultModal.style.display = "flex";
      resultModal.style.opacity = "1";
    }

    if (isWinner) {
      if (claimWinButton) {
        claimWinButton.style.display = "block";
        claimWinButton.textContent = `Забрать выигрыш`;
      }
      if (closeModalButton) {
        closeModalButton.style.display = "none";
      }
    } else {
      if (claimWinButton) {
        claimWinButton.style.display = "none";
      }
      if (closeModalButton) {
        closeModalButton.style.display = "block";
      }
    }
  }
}

function init() {
  gameState.sections = generateSections();
  drawWheel();
  setInterval(updateTimer, 1000);
  setInterval(checkGameState, 1000);

  spinButton.addEventListener("click", () => {
    const currentAction = spinButton.dataset.action || 'spin';
    if (currentAction === 'spin') {
      startSpin();
    } else {
      stopSpin();
    }
  });

  const closeModalButton = document.getElementById("close-modal");
  const claimWinButton = document.getElementById("claim-win");

  if (claimWinButton) {
    claimWinButton.addEventListener("click", function() {
      fetch(`/battle/${battleId}/claim_win`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          tg.showAlert(`Выигрыш ${data.amount.toFixed(2)}$ зачислен (комиссия: ${data.commission.toFixed(2)}$)`, () => {
            window.location.href = "/game";
          });
        } else {
          tg.showAlert(data.message || "Произошла ошибка при получении выигрыша");
        }
      })
      .catch(error => {
        console.error("Ошибка:", error);
        tg.showAlert("Произошла ошибка при получении выигрыша");
      });
    });
}

  if (closeModalButton) {
    closeModalButton.addEventListener("click", () => {
      window.location.href = "/game";
    });
  }

  tg.expand();
  tg.BackButton.show();
  tg.BackButton.onClick(() => {
    window.location.href = "/game";
  });
}

document.addEventListener("DOMContentLoaded", init);


