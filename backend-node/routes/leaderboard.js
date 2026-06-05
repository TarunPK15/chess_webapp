const express = require('express');
const User = require('../models/User');
const router = express.Router();

// @route   GET /api/leaderboard
// @desc    Get users sorted by win rate and games played
router.get('/', async (req, res) => {
    try {
        const leaderboard = await User.aggregate([
            {
                // Calculate win_rate on the fly
                $project: {
                    username: 1,
                    games_played: 1,
                    wins: 1,
                    avg_moves: 1,
                    created_at: 1,
                    win_rate: {
                        $cond: [
                            { $eq: ["$games_played", 0] }, // If games_played is 0...
                            0,                             // ...win_rate is 0
                            { $multiply: [{ $divide: ["$wins", "$games_played"] }, 100] } // Else (Wins / Games Played) * 100
                        ]
                    }
                }
            },
            // Sort by win_rate (descending), then by games_played (descending) as a tie-breaker
            { $sort: { win_rate: -1, games_played: -1 } },
            // Limit to top 50 players for performance
            { $limit: 50 } 
        ]);

        res.json(leaderboard);

    } catch (error) {
        console.error("Leaderboard Fetch Error:", error);
        res.status(500).json({ message: 'Server error fetching leaderboard.' });
    }
});

module.exports = router;