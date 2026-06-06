const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    // --- UPDATED PLAYER TRACKING ---
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    game_type: { type: String, enum: ['bot', 'pvp'], default: 'bot' },
    white_player_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    black_player_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for bot games
    // -------------------------------
    
    draw_offered_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    moves: { type: [String], default: [] },
    result: { type: String, enum: ['win', 'loss', 'draw', 'abandoned'], required: true },
    
    player_color: { type: String, enum: ['w', 'b'], default: 'w' }, // Used for bot games to know human color
    engine_mode: { type: String, default: 'ml3' }, 
    engine_depth: { type: Number, default: 3, min: 1, max: 10 },
    
    current_state: { type: mongoose.Schema.Types.Mixed }, // Store the python state dict here
    
    duration: { type: Number, required: true },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', GameSchema);