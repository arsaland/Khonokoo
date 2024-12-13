// public/js/games/khonokoo/host.js

const socket = io();

// Get room code from the DOM
const roomCode = document.getElementById('roomCodeDisplay').textContent;

// Start game
document.getElementById('startGame').addEventListener('click', () => {
  socket.emit('startGame', roomCode);
  document.getElementById('startGame').style.display = 'none';

  // Debug: Check all h1 elements
  const allH1s = document.querySelectorAll('h1');
  console.log('All H1s found:', allH1s.length);
  allH1s.forEach(h1 => console.log('H1 content:', h1.textContent));

  // Debug: Check specific welcome message
  const welcomeMessage = document.querySelector('.main-content h1');
  console.log('Welcome message found:', welcomeMessage);
  if (welcomeMessage) {
    console.log('Welcome message content:', welcomeMessage.textContent);
    console.log('Before hiding - display style:', welcomeMessage.style.display);
    welcomeMessage.style.display = 'none';
    console.log('After hiding - display style:', welcomeMessage.style.display);
  }
});

// Handle game phases
socket.on('questionPhase', (data) => {
  // Hide welcome message again (as backup)
  const welcomeMessage = document.querySelector('.main-content h1');
  if (welcomeMessage) {
    welcomeMessage.style.display = 'none';
  }

  document.getElementById('gameContent').innerHTML = `
    <h2>${data.question}</h2>
    <p><span id="timer">${data.time}</span></p>
  `;
  startTimer(data.time);
});

// ... (rest of your code)
