const mongoose = require('mongoose');

const ChallengeSchema = new mongoose.Schema({
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender_color: { type: String, enum: ['w', 'b', 'random'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    // MongoDB will automatically delete this document after 24 hours to prevent database bloat
    created_at: { type: Date, default: Date.now, expires: 86400 } 
});

module.exports = mongoose.model('Challenge', ChallengeSchema);