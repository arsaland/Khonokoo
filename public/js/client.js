// public/js/client.js
const socket = io();

document.getElementById('createRoom').addEventListener('click', () => {
    socket.emit('createRoom');
});

socket.on('roomCreated', (roomCode) => {
    window.location.href = `/host/${roomCode}`;
});

document.getElementById('joinRoom').addEventListener('click', () => {
    document.getElementById('joinForm').style.display = 'block';
});

document.getElementById('joinGame').addEventListener('click', () => {
    const roomCode = document.getElementById('roomCodeInput').value.toUpperCase();
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (roomCode && playerName) {
        window.location.href = `/player/${roomCode}?name=${encodeURIComponent(playerName)}`;
    } else {
        alert('لطفاً کد اتاق و نام خود را وارد کنید.');
    }
});

// Handle errors from server
socket.on('errorMessage', (message) => {
    alert(`خطا: ${message}`);
    console.error('Error from server:', message);
});
