// public/js/player.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if playerName is defined
    if (typeof playerName !== 'undefined' && playerName) {
        // Initialize the game interface
        initializeGameInterface(roomCode, playerName);
    } else {
        // Handle form submission to collect playerName
        const playerNameForm = document.getElementById('playerNameForm');
        if (playerNameForm) {
            playerNameForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const playerNameInput = document.getElementById('playerName');
                const name = playerNameInput.value.trim();

                if (name === '') {
                    alert('لطفاً نام خود را وارد کنید.');
                    return;
                }

                // Extract roomCode from the URL path
                const pathSegments = window.location.pathname.split('/');
                const roomCode = pathSegments[pathSegments.length - 1].toUpperCase();

                if (!roomCode) {
                    alert('کد اتاق معتبر نیست.');
                    window.location.href = '/';
                    return;
                }

                // Redirect to /player/:roomCode?name=PlayerName
                window.location.href = `/player/${roomCode}?name=${encodeURIComponent(name)}`;
            });
        }
    }
});

// Function to initialize the game interface
function initializeGameInterface(roomCode, playerName) {
    const socket = io();
    const lobbyContent = document.getElementById('lobbyContent');
    const gameplayContent = document.getElementById('gameplayContent');
    const playerList = document.getElementById('playerList');

    // Join room
    socket.emit('joinRoom', { roomCode: roomCode, playerName: playerName });

    // Update player list when players join
    socket.on('playerJoined', (players) => {
        if (playerList) {
            playerList.innerHTML = '';
            for (let playerId in players) {
                const li = document.createElement('li');
                li.textContent = players[playerId].name;
                playerList.appendChild(li);
            }
        }
    });

    // Handle game start
    socket.on('gameStarted', () => {
        if (lobbyContent) lobbyContent.style.display = 'none';
        if (gameplayContent) gameplayContent.style.display = 'block';
    });

    // Handle question phase
    socket.on('questionPhase', (data) => {
        if (gameplayContent) {
            gameplayContent.style.display = 'block';
            gameplayContent.innerHTML = `
                <h2>${data.question}</h2>
                <input type="text" id="answerInput" placeholder="پاسخ شما">
                <button id="submitAnswer" class="center-button">ارسال پاسخ</button>
                <p><span id="timer">${data.time}</span></p>
            `;
            startTimer(data.time);
        }
    });

    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error('Connection Error:', error);
        alert('خطای اتصال. لطفاً شبکه خود را بررسی کنید.');
    });

    // Handle disconnection events
    socket.on('disconnect', (reason) => {
        console.warn('Socket disconnected:', reason);
        alert('ارتباط با سرور قطع شد. در حال تلاش برای اتصال مجدد...');
    });

    // Handle reconnection attempts
    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
        // Re-emit joinRoom upon reconnection
        socket.emit('joinRoom', { roomCode: roomCode, playerName: playerName });
    });

    // Listen for game phases and handle them accordingly

    // 1. Question Phase
    socket.on('questionPhase', (data) => {
        displayQuestionPhase(data.question, data.time, socket, roomCode);
    });

    // 2. Voting Phase
    socket.on('votingPhase', (data) => {
        displayVotingPhase(data.answers, data.time, socket, roomCode);
    });

    // 3. Results Phase
    socket.on('resultsPhase', (data) => {
        displayResultsPhase(data.results);
    });

    // 4. Game Over
    socket.on('gameOver', (data) => {
        displayGameOver(data.finalScores, data.players);
    });

    // Handle errors from the server
    socket.on('errorMessage', (message) => {
        alert(`خطا: ${message}`);
        console.error('Error from server:', message);
        window.location.href = '/';
    });

    // Handle host disconnection
    socket.on('hostDisconnected', () => {
        alert('میزبان از بازی خارج شد. بازی به پایان می‌رسد.');
        window.location.href = '/';
    });

    // Handle player leaving (optional - can be used to update UI)
    socket.on('playerLeft', (players) => {
        // Optionally, notify the player or update the UI
        console.log('بازیکنان باقی‌مانده:', players);
    });
}

// Function to display the Question Phase
function displayQuestionPhase(question, time, socket, roomCode) {
    const gameInterface = document.getElementById('gameInterface');
    gameInterface.innerHTML = `
      <h2>${question}</h2>
      <input type="text" id="answerInput" placeholder="پاسخ شما">
      <button id="submitAnswer" class="center-button">ارسال پاسخ</button>
      <p><span id="timer">${time}</span></p>
    `;

    // Start the countdown timer
    startTimer(time, 'timer');

    // Add event listener for submitting the answer
    document.getElementById('submitAnswer').addEventListener('click', () => {
        const answerInput = document.getElementById('answerInput');
        const answer = answerInput.value.trim();

        if (answer !== '') {
            // Emit the submitAnswer event to the server
            socket.emit('submitAnswer', { roomCode: roomCode, answer: answer });

            // Inform the player that their answer has been submitted
            gameInterface.innerHTML = '<h2>در انتظار بازیکنان دیگر...</h2>';
        } else {
            alert('لطفاً پاسخ خود را وارد کنید.');
        }
    });
}

// Function to display the Voting Phase
function displayVotingPhase(answers, time, socket, roomCode) {
    const gameInterface = document.getElementById('gameInterface');
    let answersHtml = '<h2 class="voting-title">بهترین پاسخ را انتخاب کنید!</h2><div class="answer-container">';

    for (let playerId in answers) {
        // Prevent voting for own answer
        if (playerId !== socket.id) {
            answersHtml += `
                <div class="answer-box">
                    <span class="answer-text">${answers[playerId].answer}</span>
                    <button class="vote-button" data-player-id="${playerId}">رای</button>
                </div>
            `;
        }
    }

    answersHtml += `</div><p><span id="timer">${time}</span></p>`;
    gameInterface.innerHTML = answersHtml;

    // Start the countdown timer
    startTimer(time, 'timer');

    // Add event listeners for voting buttons
    const voteButtons = document.querySelectorAll('.vote-button');
    voteButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const voteFor = btn.getAttribute('data-player-id');
            socket.emit('submitVote', { roomCode: roomCode, vote: voteFor });

            // Update UI after voting
            gameInterface.innerHTML = '<h2 class="voting-title">از رای شما متشکریم!</h2>';
        });
    });
}

// Function to display the Results Phase
function displayResultsPhase(results) {
    const gameInterface = document.getElementById('gameInterface');
    let resultsHtml = `
        <div class="results-container">
            <h2 class="results-title">نتایج این دور</h2>
            <div class="results-list">`;

    results.forEach(result => {
        resultsHtml += `
            <div class="result-item">
                <div class="player-name">${result.playerName}</div>
                <div class="player-answer">"${result.answer}"</div>
                <div class="vote-count">${result.votes} رای</div>
            </div>`;
    });

    resultsHtml += `</div></div>`;
    gameInterface.innerHTML = resultsHtml;
}

// Function to display the Game Over Screen
function displayGameOver(finalScores, players) {
    const gameInterface = document.getElementById('gameInterface');
    let finalScoresHtml = '<h2>پایان بازی - امتیازات نهایی</h2><ul>';

    for (let playerId in finalScores) {
        const playerName = players[playerId].name;
        finalScoresHtml += `<li>${playerName}: ${finalScores[playerId]} امتیاز</li>`;
    }

    finalScoresHtml += '</ul>';
    gameInterface.innerHTML = finalScoresHtml;
}

// Timer Function
function startTimer(duration, elementId) {
    let timer = duration;
    const timerElement = document.getElementById(elementId);

    const countdown = setInterval(() => {
        timer--;
        if (timerElement) {
            timerElement.textContent = timer;
        }

        if (timer <= 0) {
            clearInterval(countdown);
        }
    }, 1000);
}
