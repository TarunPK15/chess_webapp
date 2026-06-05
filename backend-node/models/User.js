const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username:     { type: String, required: true, unique: true, trim: true },
    email:        { type: String, trim: true, default: '' },
    password_hash:{ type: String, required: true },
    games_played: { type: Number, default: 0 },
    wins:         { type: Number, default: 0 },
    avg_moves:    { type: Number, default: 0 },
    avatar_piece: { type: String, default: 'K', enum: ['K','Q','R','B','N','P'] },
    avatar_color: { type: String, default: 'w', enum: ['w','b'] },
    created_at:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);