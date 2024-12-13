// public/js/host.js
const socket = io(); // Use relative path to handle different environments
const roomCode = window.location.pathname.split('/')[2];
document.getElementById('roomCodeDisplay').innerText = roomCode;

// Join the room as host
socket.emit('joinRoom', { roomCode, isHost: true });

// Handle connection errors
socket.on('connect_error', (error) => {
    console.error('Connection Error:', error);
    alert('خطای اتصال. لطفاً شبکه خود را بررسی کنید.');
});

socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
    alert('ارتباط با سرور قطع شد. در حال تلاش برای اتصال مجدد...');
});

// Reconnect handling
socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
    socket.emit('joinRoom', { roomCode, isHost: true });
});

// Listen for player joins
socket.on('playerJoined', (players) => {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';
    for (let playerId in players) {
        const li = document.createElement('li');
        li.textContent = players[playerId].name;
        playerList.appendChild(li);
    }
    if (Object.keys(players).length > 1) {
        document.getElementById('startGame').style.display = 'block';
    }
});

// Start game
document.getElementById('startGame').addEventListener('click', () => {
    socket.emit('startGame', roomCode);
    document.getElementById('startGame').style.display = 'none';
    // Hide the player list when game starts
    document.getElementById('playerList').style.display = 'none';
});

// Handle game phases
socket.on('questionPhase', (data) => {
    // Ensure player list stays hidden during game phases
    document.getElementById('playerList').style.display = 'none';

    document.getElementById('gameContent').innerHTML = `
    <h2>${data.question}</h2>
    <p><span id="timer">${data.time}</span></p>
  `;
    startTimer(data.time);
});

socket.on('votingPhase', (data) => {
    let answersHtml = '<h2>بهترین پاسخ را انتخاب کنید!</h2><ul>';
    for (let playerId in data.answers) {
        answersHtml += `<li class="answer-box">${data.answers[playerId].answer}</li>`;
    }
    answersHtml += '</ul><p><span id="timer">' + data.time + '</span></p>';
    document.getElementById('gameContent').innerHTML = answersHtml;
    startTimer(data.time);
});

// Handle results phase
socket.on('resultsPhase', (data) => {
    let resultsHtml = '<h2>نتایج</h2><ul>';
    data.results.forEach(result => {
        resultsHtml += `<li>${result.playerName}: "${result.answer}" - ${result.votes} رای</li>`;
    });
    resultsHtml += '</ul>';
    document.getElementById('gameContent').innerHTML = resultsHtml;
});

// Handle game over
socket.on('gameOver', (data) => {
    let finalScoresHtml = '<h2>پایان بازی - امتیازات نهایی</h2><ul>';
    for (let playerId in data.finalScores) {
        const playerName = data.players[playerId].name;
        finalScoresHtml += `<li>${playerName}: ${data.finalScores[playerId]} امتیاز</li>`;
    }
    finalScoresHtml += '</ul>';
    document.getElementById('gameContent').innerHTML = finalScoresHtml;
});

// Timer function
function startTimer(duration) {
    let timer = duration;
    const timerElement = document.getElementById('timer');
    const countdown = setInterval(() => {
        timer--;
        timerElement.textContent = timer;
        if (timer <= 0) {
            clearInterval(countdown);
        }
    }, 1000);
}

// Handle host disconnection
socket.on('hostDisconnected', () => {
    alert('شما قطع شده‌اید. بازی به پایان می‌رسد.');
    window.location.href = '/';
});

// Handle errors from server
socket.on('errorMessage', (message) => {
    alert(`خطا: ${message}`);
    console.error('Error from server:', message);
});
