module.exports = function (io) {
    const fs = require('fs');
    const path = require('path');

    // Handle unhandled exceptions
    process.on('uncaughtException', function (err) {
        console.error('Unhandled Exception:', err);
    });

    // Load questions from external file synchronously
    let allQuestions = [];
    try {
        const data = fs.readFileSync(path.join(__dirname, '../data/questions.json'), 'utf8');
        allQuestions = JSON.parse(data);
        console.log(`Loaded ${allQuestions.length} questions.`);
    } catch (err) {
        console.error('Error reading questions file:', err);
    }

    // Game state
    let rooms = {};

    // Keep track of disconnected hosts for reconnection
    let disconnectedHosts = {};

    // Socket.io connection handler
    io.on('connection', (socket) => {
        console.log(`[Connection] Socket connected: ${socket.id}`);

        // Handle room creation
        socket.on('createRoom', () => {
            const roomCode = generateRoomCode();
            rooms[roomCode] = {
                host: socket.id,
                players: {},
                state: 'lobby',
                answers: {},
                votes: {},
                scores: {},
                currentRound: 1,
                maxRounds: 6, // Number of rounds
                timers: {}, // Object to hold interval references
            };
            socket.join(roomCode);
            console.log(`[Room Created] Room code: ${roomCode}, Host ID: ${socket.id}`);
            socket.emit('roomCreated', roomCode);
        });

        // Handle joining a room
        socket.on('joinRoom', ({ roomCode, playerName }) => {
            roomCode = roomCode.toUpperCase();
            console.log(`[Join Attempt] Socket ID: ${socket.id}, Room Code: ${roomCode}, Player Name: ${playerName}`);

            if (rooms[roomCode]) {
                if (playerName) {
                    // Player joining
                    rooms[roomCode].players[socket.id] = {
                        name: playerName,
                        score: 0,
                    };
                    socket.join(roomCode);
                    console.log(`[Player Joined] Room code: ${roomCode}, Player Name: ${playerName}, Socket ID: ${socket.id}`);
                    io.to(roomCode).emit('playerJoined', rooms[roomCode].players);
                } else {
                    // Host reconnection
                    rooms[roomCode].host = socket.id;
                    socket.join(roomCode);
                    console.log(`[Host Reconnected] Room code: ${roomCode}, Host ID: ${socket.id}`);
                }
            } else if (disconnectedHosts[roomCode] && !playerName) {
                // Allow the host to reconnect within a grace period
                rooms[roomCode] = disconnectedHosts[roomCode];
                rooms[roomCode].host = socket.id;
                delete disconnectedHosts[roomCode];
                socket.join(roomCode);
                console.log(`[Host Reconnected] Room code: ${roomCode}, Host ID: ${socket.id}`);
            } else {
                console.log(`[Join Error] Room not found: ${roomCode}`);
                socket.emit('errorMessage', 'اتاق وجود ندارد.');
            }
        });

        // Handle game start
        socket.on('startGame', (roomCode) => {
            roomCode = roomCode.toUpperCase();
            console.log(`[Start Game] Host ID: ${socket.id}, Room Code: ${roomCode}`);
            if (rooms[roomCode] && rooms[roomCode].host === socket.id) {
                rooms[roomCode].state = 'questionPhase';
                rooms[roomCode].answers = {}; // Reset answers
                rooms[roomCode].votes = {}; // Reset votes
                rooms[roomCode].scores = rooms[roomCode].scores || {};
                rooms[roomCode].currentRound = 1;
                rooms[roomCode].maxRounds = 6; // Number of rounds
                startQuestionPhase(roomCode);
            } else {
                console.log(`[Start Game Error] Unauthorized attempt or room does not exist. Host ID: ${socket.id}, Room Code: ${roomCode}`);
                socket.emit('errorMessage', 'شما مجاز به شروع بازی نیستید.');
            }
        });

        // Handle player answers
        socket.on('submitAnswer', ({ roomCode, answer }) => {
            // Logic to handle submitted answers
        });

        // Handle votes
        socket.on('submitVote', ({ roomCode, vote }) => {
            // Logic to handle votes
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            // Logic to handle player and host disconnections
        });
    });

    // Helper functions
    function startQuestionPhase(roomCode) {
        // Logic to start the question phase
    }

    function startVotingPhase(roomCode) {
        // Logic to start the voting phase
    }

    function startResultsPhase(roomCode) {
        // Logic to start the results phase
    }

    function generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (rooms[code] || disconnectedHosts[code]) {
            return generateRoomCode(); // Recursively generate a new code
        }
        return code;
    }

    // Additional utility functions and logic
};
