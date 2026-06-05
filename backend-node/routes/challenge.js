const express = require('express');
const Challenge = require('../models/Challenge');
const Game = require('../models/Game');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// @route   POST /api/challenges
// @desc    Send a challenge to another user
router.post('/', auth, async (req, res) => {
    try {
        const { receiver_username, sender_color } = req.body;
        
        // Find the user they are trying to challenge
        const receiver = await User.findOne({ username: receiver_username });
        if (!receiver) return res.status(404).json({ error: 'User not found' });
        
        if (receiver._id.toString() === req.user.userId) {
            return res.status(400).json({ error: 'You cannot challenge yourself' });
        }

        const challenge = new Challenge({
            sender_id: req.user.userId,
            receiver_id: receiver._id,
            sender_color: sender_color || 'random'
        });
        
        await challenge.save();
        
        // Notify the receiver in real-time
        const io = req.app.get('io');
        if (io) io.to(`user_${receiver._id}`).emit('new_challenge', {
            challenge_id: challenge._id,
            sender_username: req.user.username,
            color: challenge.sender_color
        });

        res.status(201).json(challenge);
    } catch (err) {
        res.status(500).json({ error: 'Failed to send challenge' });
    }
});

// @route   GET /api/challenges/pending
// @desc    Get all incoming pending challenges for the logged-in user
router.get('/pending', auth, async (req, res) => {
    try {
        const challenges = await Challenge.find({ 
            receiver_id: req.user.userId, 
            status: 'pending' 
        }).populate('sender_id', 'username elo'); // Pull in sender's username
        
        res.json(challenges);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

// @route   POST /api/challenges/:id/accept
// @desc    Accept a challenge and generate the PvP game session
router.post('/:id/accept', auth, async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.id);
        if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
        
        // Ensure only the receiver can accept it
        if (challenge.receiver_id.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        challenge.status = 'accepted';
        await challenge.save();

        // Color Resolution
        let finalSenderColor = challenge.sender_color;
        if (finalSenderColor === 'random') {
            finalSenderColor = Math.random() > 0.5 ? 'w' : 'b';
        }

        const whitePlayerId = finalSenderColor === 'w' ? challenge.sender_id : challenge.receiver_id;
        const blackPlayerId = finalSenderColor === 'b' ? challenge.sender_id : challenge.receiver_id;

        // Create the PvP Game
        const newGame = new Game({
            user_id: challenge.sender_id,
            game_type: 'pvp',
            white_player_id: whitePlayerId,
            black_player_id: blackPlayerId,
            result: 'abandoned',
            duration: 0
        });
        
        await newGame.save();

        // Notify the sender that their challenge was accepted, and give them the Game ID to redirect
        const io = req.app.get('io');
        if (io) io.to(`user_${challenge.sender_id}`).emit('challenge_accepted', {
            game_id: newGame._id,
            color: finalSenderColor
        });

        // Return the game info to the receiver so they can redirect too
        res.json({
            game_id: newGame._id,
            color: finalSenderColor === 'w' ? 'b' : 'w'
        });

    } catch (err) {
        res.status(500).json({ error: 'Failed to accept challenge' });
    }
});

module.exports = router;