const express = require('express');
const router = express.Router();

// Game Lobby Route
router.get('/', (req, res) => {
    res.render('games/khonokoo/index');
});

// Host Screen
router.get('/host/:roomCode', (req, res) => {
    res.render('games/khonokoo/host', { roomCode: req.params.roomCode });
});

// Player Screen
router.get('/player/:roomCode', (req, res) => {
    res.render('games/khonokoo/player', {
        roomCode: req.params.roomCode,
        playerName: req.query.name,
    });
});

// Health Check Endpoint
router.get('/health', (req, res) => {
    res.status(200).send('OK');
});

module.exports = router;
