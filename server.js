// server.js

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const path = require('path');
const fs = require('fs');

// Handle unhandled exceptions
process.on('uncaughtException', function (err) {
  console.error('Unhandled Exception:', err);
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Load questions from external file synchronously
let allQuestions = [];
try {
  const data = fs.readFileSync('questions.json', 'utf8');
  allQuestions = JSON.parse(data);
  console.log(`Loaded ${allQuestions.length} questions.`);
} catch (err) {
  console.error('Error reading questions file:', err);
}

// Game state
let rooms = {};

// Keep track of disconnected hosts for reconnection
let disconnectedHosts = {};

// Existing routes
app.get('/', (req, res) => {
  res.render('index');
});

// Host screen
app.get('/host/:roomCode', (req, res) => {
  res.render('host', { roomCode: req.params.roomCode });
});

// Player screen
app.get('/player/:roomCode', (req, res) => {
  res.render('player', { roomCode: req.params.roomCode, playerName: req.query.name });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

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
    console.log(`[Join Attempt] Socket ID: ${socket.id}, Room Code: ${roomCode}, Player Name: ${playerName}, Is Host: ${playerName ? 'false' : 'true'}`);

    if (rooms[roomCode]) {
      if (!playerName) {
        // If playerName is not provided, treat as host reconnection
        rooms[roomCode].host = socket.id;
        socket.join(roomCode);
        console.log(`[Host Reconnected] Room code: ${roomCode}, Host ID: ${socket.id}`);
      } else {
        // Player joining
        rooms[roomCode].players[socket.id] = {
          name: playerName,
          score: 0,
        };
        socket.join(roomCode);
        console.log(`[Player Joined] Room code: ${roomCode}, Player Name: ${playerName}, Socket ID: ${socket.id}`);
        io.to(roomCode).emit('playerJoined', rooms[roomCode].players);
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
      rooms[roomCode].votes = {};   // Reset votes
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
    roomCode = roomCode.toUpperCase();
    console.log(`[Submit Answer] Socket ID: ${socket.id}, Room Code: ${roomCode}, Answer: ${answer}`);
    if (rooms[roomCode]) {
      if (!rooms[roomCode].players[socket.id]) {
        socket.emit('errorMessage', 'شما عضو این اتاق نیستید.');
        console.log(`[Submit Answer Error] Player not found: Socket ID: ${socket.id}`);
        return;
      }
      rooms[roomCode].answers[socket.id] = {
        player: rooms[roomCode].players[socket.id].name,
        answer: answer,
      };

      // Check if all players have answered
      if (allPlayersAnswered(roomCode)) {
        // Proceed to voting phase
        clearInterval(rooms[roomCode].timers.questionTimerInterval);
        startVotingPhase(roomCode);
      }
    } else {
      console.log(`[Submit Answer Error] Room not found: ${roomCode}`);
    }
  });

  // Handle votes
  socket.on('submitVote', ({ roomCode, vote }) => {
    roomCode = roomCode.toUpperCase();
    console.log(`[Submit Vote] Socket ID: ${socket.id}, Room Code: ${roomCode}, Voted For: ${vote}`);
    if (rooms[roomCode]) {
      rooms[roomCode].votes[socket.id] = vote;

      // Check if all players have voted
      if (allPlayersVoted(roomCode)) {
        // Proceed to results phase
        clearInterval(rooms[roomCode].timers.votingTimerInterval);
        startResultsPhase(roomCode);
      }
    } else {
      console.log(`[Submit Vote Error] Room not found: ${roomCode}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[Disconnection] Socket disconnected: ${socket.id}`);

    for (let roomCode in rooms) {
      // Handle host disconnection
      if (rooms[roomCode].host === socket.id) {
        console.log(`[Host Disconnected] Host ID: ${socket.id}, Room Code: ${roomCode}`);
        // Move room to disconnectedHosts and set a timeout
        disconnectedHosts[roomCode] = rooms[roomCode];
        delete rooms[roomCode];

        // Set a timeout to remove the room if the host doesn't reconnect
        setTimeout(() => {
          if (disconnectedHosts[roomCode]) {
            console.log(`[Room Closed] Room code: ${roomCode} due to host not reconnecting`);
            io.to(roomCode).emit('hostDisconnected');
            delete disconnectedHosts[roomCode];
          }
        }, 10000); // 10 seconds grace period
      }

      // Handle player disconnection
      if (rooms[roomCode] && rooms[roomCode].players[socket.id]) {
        console.log(`[Player Left] Player ID: ${socket.id}, Name: ${rooms[roomCode].players[socket.id].name}, Room Code: ${roomCode}`);
        delete rooms[roomCode].players[socket.id];
        io.to(roomCode).emit('playerLeft', rooms[roomCode].players);
      }
    }
  });
});

// Helper function to start the question phase
function startQuestionPhase(roomCode) {
  if (rooms[roomCode]) {
    const question = getRandomQuestion();
    rooms[roomCode].currentQuestion = question;
    rooms[roomCode].answers = {};
    rooms[roomCode].votes = {};
    rooms[roomCode].state = 'questionPhase';

    io.to(roomCode).emit('questionPhase', {
      question: question,
      time: 60, // 60 seconds for answering
    });
    console.log(`[Question Phase] Round ${rooms[roomCode].currentRound} started for Room Code: ${roomCode}`);

    // Start timer for question phase
    rooms[roomCode].questionTimer = 60; // Initialize timer
    rooms[roomCode].timers.questionTimerInterval = setInterval(() => {
      if (!rooms[roomCode]) {
        clearInterval(rooms[roomCode]?.timers?.questionTimerInterval);
        return;
      }
      rooms[roomCode].questionTimer--;
      if (allPlayersAnswered(roomCode) || rooms[roomCode].questionTimer <= 0) {
        clearInterval(rooms[roomCode].timers.questionTimerInterval);
        startVotingPhase(roomCode);
      }
    }, 1000);
  }
}

// Helper function to start the voting phase
function startVotingPhase(roomCode) {
  if (rooms[roomCode]) {
    rooms[roomCode].state = 'votingPhase';

    io.to(roomCode).emit('votingPhase', {
      answers: rooms[roomCode].answers,
      time: 30, // 30 seconds for voting
    });
    console.log(`[Voting Phase] Round ${rooms[roomCode].currentRound} started for Room Code: ${roomCode}`);

    // Start timer for voting phase
    rooms[roomCode].votingTimer = 30; // Initialize timer
    rooms[roomCode].timers.votingTimerInterval = setInterval(() => {
      if (!rooms[roomCode]) {
        clearInterval(rooms[roomCode]?.timers?.votingTimerInterval);
        return;
      }
      rooms[roomCode].votingTimer--;
      if (allPlayersVoted(roomCode) || rooms[roomCode].votingTimer <= 0) {
        clearInterval(rooms[roomCode].timers.votingTimerInterval);
        startResultsPhase(roomCode);
      }
    }, 1000);
  }
}

// Helper function to start the results phase
function startResultsPhase(roomCode) {
  if (rooms[roomCode]) {
    rooms[roomCode].state = 'resultsPhase';
    const results = tallyVotesAndCalculateScores(rooms[roomCode]);

    io.to(roomCode).emit('resultsPhase', {
      results: results,
      scores: rooms[roomCode].scores,
    });
    console.log(`[Results Phase] Round ${rooms[roomCode].currentRound} for Room Code: ${roomCode}`);

    // Wait before starting next round or ending the game
    rooms[roomCode].timers.resultsTimeout = setTimeout(() => {
      if (rooms[roomCode]) {
        if (rooms[roomCode].currentRound < rooms[roomCode].maxRounds) {
          rooms[roomCode].currentRound++;
          startQuestionPhase(roomCode);
        } else {
          // Game over
          io.to(roomCode).emit('gameOver', {
            finalScores: rooms[roomCode].scores,
            players: rooms[roomCode].players,
          });
          console.log(`[Game Over] Room Code: ${roomCode}`);

          // Clear any remaining intervals
          clearAllRoomTimers(roomCode);

          // Clean up the room
          delete rooms[roomCode];
        }
      }
    }, 15000); // Display results for 15 seconds
  }
}

// Function to clear all timers for a room
function clearAllRoomTimers(roomCode) {
  if (rooms[roomCode] && rooms[roomCode].timers) {
    const timers = rooms[roomCode].timers;
    if (timers.questionTimerInterval) {
      clearInterval(timers.questionTimerInterval);
    }
    if (timers.votingTimerInterval) {
      clearInterval(timers.votingTimerInterval);
    }
    if (timers.resultsTimeout) {
      clearTimeout(timers.resultsTimeout);
    }
  }
}

// Helper function to check if all players have submitted answers
function allPlayersAnswered(roomCode) {
  if (!rooms[roomCode]) return false;
  const playerIds = Object.keys(rooms[roomCode].players);
  const answerIds = Object.keys(rooms[roomCode].answers);
  return playerIds.length === answerIds.length;
}

// Helper function to check if all players have voted
function allPlayersVoted(roomCode) {
  if (!rooms[roomCode]) return false;
  const playerIds = Object.keys(rooms[roomCode].players);
  const voteIds = Object.keys(rooms[roomCode].votes);
  return playerIds.length === voteIds.length;
}

// Function to get a random question
function getRandomQuestion() {
  if (allQuestions.length === 0) {
    return 'No questions available.';
  }
  const index = Math.floor(Math.random() * allQuestions.length);
  return allQuestions[index];
}

// Utility function to tally votes and calculate scores
function tallyVotesAndCalculateScores(room) {
  const voteCounts = {};
  for (let voterId in room.votes) {
    const votedFor = room.votes[voterId];
    if (!voteCounts[votedFor]) {
      voteCounts[votedFor] = 0;
    }
    voteCounts[votedFor] += 1;
  }

  const results = [];
  for (let playerId in room.answers) {
    const playerName = room.answers[playerId].player;
    const answer = room.answers[playerId].answer;
    const votes = voteCounts[playerId] || 0;

    // Update player's score
    if (!room.scores[playerId]) {
      room.scores[playerId] = 0;
    }
    room.scores[playerId] += votes;

    results.push({
      playerId,
      playerName,
      answer,
      votes,
    });
  }

  return results;
}

// Utility function to generate room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure room code is unique
  if (rooms[code] || disconnectedHosts[code]) {
    return generateRoomCode(); // Recursively generate a new code
  }
  return code;
}

const PORT = process.env.PORT || 8081;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
