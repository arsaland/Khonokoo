const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    purchases: [{
        game: String,
        packId: String,
        purchaseDate: Date,
    }],
});

module.exports = mongoose.model('User', userSchema);
