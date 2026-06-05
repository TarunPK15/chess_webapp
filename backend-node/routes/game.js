const express = require('express');
const axios = require('axios');
const Game = require('../models/Game');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

const PYTHON_API = 'http://127.0.0.1:5001';

// --- Helper: Update User Stats on Game Over ---
async function updateUserStats(userId, result, totalMoves) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        const currentTotal = user.avg_moves * user.games_played;
        
        user.games_played += 1;
        if (result === 'win') user.wins += 1; // Human win
        
        // Calculate new moving average
        user.avg_moves = Math.round((currentTotal + totalMoves) / user.games_played);
        
        await user.save();
    } catch (err) {
        console.error("Error updating user stats:", err);
    }
}

// @route   POST /api/games
// @desc    Create a new game session in MongoDB
router.post('/', auth, async (req, res) => {
    try {
        const newGame = new Game({
            user_id: req.user.userId,
            white_player_id: req.user.userId,
            player_color: req.body.player_color || 'w',
            engine_mode: req.body.engine_mode || 'ml3',
            engine_depth: req.body.engine_depth || 3,
            result: 'abandoned',
            duration: 0
        });
        await newGame.save();
        
        res.status(201).json({
            game_id: newGame._id,
            player_color: newGame.player_color,
            engine_mode: newGame.engine_mode,
            engine_depth: newGame.engine_depth,
            initial_state: "startpos" 
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create game session' });
    }
});

// @route   POST /api/games/:id/move
// @desc    Process human move, query Python AI, return response
// @route   POST /api/games/:id/move
// @desc    Process human move, query Python AI (if bot game), return response
router.post('/:id/move', auth, async (req, res) => {
    try {
        const { game_state, piece, target } = req.body;
        const gameId = req.params.id;
        const game = await Game.findById(gameId);

        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.result !== 'abandoned') return res.status(400).json({ error: 'Game is already over' });

        // --- 1. TURN VALIDATION (Bot vs PvP) ---
        if (game.game_type === 'pvp') {
            // PvP: White plays on even move counts, Black plays on odd
            const isWhiteTurn = game.moves.length % 2 === 0;
            const expectedUserId = isWhiteTurn ? game.white_player_id.toString() : game.black_player_id.toString();
            
            if (req.user.userId !== expectedUserId) {
                return res.status(403).json({ error: "It is not your turn to move." });
            }
        } else {
            // Bot Game: Validate against the chosen player_color
            const isHumanTurn = (game.player_color === 'w' && game.moves.length % 2 === 0) || 
                                (game.player_color === 'b' && game.moves.length % 2 !== 0);
            if (!isHumanTurn) {
                return res.status(400).json({ error: "It is not your turn to move." });
            }
        }

        // --- 2. VALIDATE MOVE VIA PYTHON ---
        const validateRes = await axios.post(`${PYTHON_API}/validate-move`, {
            game_state: game_state, 
            piece: piece, 
            target: target
        });
        
        if (!validateRes.data.valid) {
            return res.status(400).json({ error: 'Illegal move attempted' });
        }

        // Save Human Move
        const humanMoveStr = `${piece}_${target[0]}${target[1]}`;
        game.moves.push(humanMoveStr);

        const io = req.app.get('io');

        // --- 3. FORK: PVP vs BOT ---
        if (game.game_type === 'pvp') {
            // PVP MODE: Save move and broadcast to the opponent instantly
            game.current_state = validateRes.data.updated_state;
            await game.save();

            if (io) io.to(gameId).emit('pvp_move', {
                piece: piece,
                target: target,
                move_str: humanMoveStr,
                updated_state: validateRes.data.updated_state
            });

            return res.json({
                valid: true,
                human_move: humanMoveStr,
                game_status: game.result
            });

        } else {
            // BOT MODE: Ask Python for the counter-attack
            const pythonResponse = await axios.post(`${PYTHON_API}/move`, {
                game_state: validateRes.data.updated_state,
                engine_mode: game.engine_mode,
                depth: game.engine_depth
            });
            
            const aiData = pythonResponse.data;

            if (aiData.piece && aiData.target) {
                const aiMoveStr = `${aiData.piece}_${aiData.target[0]}${aiData.target[1]}`;
                game.moves.push(aiMoveStr);
            }

            // Check Game End Conditions
            if (aiData.is_checkmate) {
                game.result = (aiData.piece === null) ? 'win' : 'loss';
                await updateUserStats(game.user_id, game.result, game.moves.length);
            } else if (aiData.is_stalemate) {
                game.result = 'draw';
                await updateUserStats(game.user_id, game.result, game.moves.length);
            }

            if (aiData.updated_state) {
                game.current_state = aiData.updated_state;
            }

            await game.save();

            if (io) io.to(gameId).emit('engine_move', aiData);

            return res.json({
                valid: true,
                human_move: humanMoveStr,
                ai_response: aiData,
                game_status: game.result
            });
        }

    } catch (err) {
        console.error("Move processing error:", err.message);
        res.status(500).json({ error: 'Move processing failed' });
    }
});

// @route   POST /api/games/:id/engine-move-only
// @desc    Forces the AI to make a move (used when Human plays Black and AI goes first)
router.post('/:id/engine-move-only', auth, async (req, res) => {
    try {
        const { game_state } = req.body;
        const gameId = req.params.id;
        const game = await Game.findById(gameId);

        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.result !== 'abandoned') return res.status(400).json({ error: 'Game is already over' });
        
        // Ensure it is actually the Engine's turn
        const isEngineTurn = (game.player_color === 'w' && game.moves.length % 2 !== 0) || 
                             (game.player_color === 'b' && game.moves.length % 2 === 0);
                             
        if (!isEngineTurn) return res.status(400).json({ error: "It is not the engine's turn." });

        // Query Python Engine directly
        const pythonResponse = await axios.post(`${PYTHON_API}/move`, {
            game_state: game_state,
            engine_mode: game.engine_mode,
            depth: game.engine_depth
        });
        
        const aiData = pythonResponse.data;

        if (aiData.piece && aiData.target) {
            const aiMoveStr = `${aiData.piece}_${aiData.target[0]}${aiData.target[1]}`;
            game.moves.push(aiMoveStr);
        }

        // Check End Conditions (AI checkmating Human)
        if (aiData.is_checkmate) {
            game.result = 'loss'; 
            await updateUserStats(game.user_id, game.result, game.moves.length);
        } else if (aiData.is_stalemate) {
            game.result = 'draw';
            await updateUserStats(game.user_id, game.result, game.moves.length);
        }

        if (aiData.updated_state) {
            game.current_state = aiData.updated_state;
        }

        await game.save();

        const io = req.app.get('io');
        if (io) io.to(gameId).emit('engine_move', aiData);

        res.json({ ai_response: aiData, game_status: game.result });

    } catch (err) {
        res.status(500).json({ error: 'Engine move failed' });
    }
});

// @route   POST /api/games/:id/forfeit
// @desc    Resign from the current game
router.post('/:id/forfeit', auth, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.result !== 'abandoned') return res.status(400).json({ error: 'Game is already over' });

        const isPvp = game.game_type === 'pvp';
        const isWhite = req.user.userId === game.white_player_id.toString();
        const isBlack = game.black_player_id && req.user.userId === game.black_player_id.toString();

        if (!isWhite && !isBlack) return res.status(403).json({ error: 'You are not a player in this game' });

        if (isPvp) {
            // For PvP, the one who forfeits gets a loss, opponent gets a win
            // Here we just mark 'loss' relative to the person who requested (simplification for stats)
            // Or we can be explicit. Let's just give the forfeiters a loss in their stats.
            game.result = isWhite ? '0-1' : '1-0'; // Just an example, standard result is win/loss/draw.
            // Let's use 'loss' for single user stats but we need to update both. 
            // In our simple schema, we just have 'loss' and 'win'. 
            // We'll mark 'loss' to signify the game was forfeited. 
            // For bot games, the human always loses.
            game.result = 'loss';
            await updateUserStats(req.user.userId, 'loss', game.moves.length);
            // If we had opponent stats, we'd update them here.
        } else {
            // Bot game: user resigns
            game.result = 'loss';
            await updateUserStats(game.user_id, game.result, game.moves.length);
        }

        await game.save();

        const io = req.app.get('io');
        if (io) io.to(game.id).emit('game_over', { result: game.result, reason: 'forfeit', by: req.user.userId });

        res.json({ success: true, game_status: game.result });
    } catch (err) {
        res.status(500).json({ error: 'Forfeit failed' });
    }
});

// @route   POST /api/games/:id/draw
// @desc    Offer a draw
router.post('/:id/draw', auth, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.result !== 'abandoned') return res.status(400).json({ error: 'Game is already over' });

        const isPvp = game.game_type === 'pvp';
        
        if (isPvp) {
            // PVP Draw logic: normally you'd emit a draw offer to the other player.
            // For now, let's just make it auto-accept or return an error if complex PVP draws aren't fully spec'd.
            // As per plan, we are auto-accepting for bots. For PVP, we can also auto-accept for simplicity.
            game.result = 'draw';
            await updateUserStats(game.white_player_id, 'draw', game.moves.length);
            if (game.black_player_id) await updateUserStats(game.black_player_id, 'draw', game.moves.length);
        } else {
            // Bot game: Engine auto-accepts draw
            game.result = 'draw';
            await updateUserStats(game.user_id, game.result, game.moves.length);
        }

        await game.save();

        const io = req.app.get('io');
        if (io) io.to(game.id).emit('game_over', { result: 'draw', reason: 'mutual agreement' });

        res.json({ success: true, game_status: game.result });
    } catch (err) {
        res.status(500).json({ error: 'Draw offer failed' });
    }
});

// @route   GET /api/games/my-games
// @desc    Get the current user's game history (most recent first)
router.get('/my-games', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const games = await Game.find({ user_id: req.user.userId })
            .sort({ created_at: -1 })
            .limit(limit)
            .populate('white_player_id', 'username')
            .populate('black_player_id', 'username')
            .lean();

        const formatted = games.map(g => ({
            _id: g._id,
            game_type: g.game_type,
            result: g.result,
            engine_mode: g.engine_mode,
            engine_depth: g.engine_depth,
            player_color: g.player_color,
            move_count: g.moves ? g.moves.length : 0,
            duration: g.duration,
            created_at: g.created_at,
            opponent: g.game_type === 'pvp'
                ? (g.player_color === 'w' ? g.black_player_id?.username : g.white_player_id?.username) || 'Opponent'
                : (g.engine_mode && g.engine_mode.startsWith('ml') ? `ML StonkFish (depth ${g.engine_depth})` : `Greedy StonkFish (depth ${g.engine_depth})`)
        }));

        res.json(formatted);
    } catch (err) {
        console.error('my-games error:', err);
        res.status(500).json({ error: 'Failed to fetch game history' });
    }
});

// @route   GET /api/games/:id
// @desc    Get full game state (for resume)
router.get('/:id', auth, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        res.json(game);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch game' });
    }
});

// @route   GET /api/games/:id/history
// @desc    Get move history (PGN-like) for replay
router.get('/:id/history', auth, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        
        res.json({ 
            moves: game.moves,
            result: game.result,
            engine_mode: game.engine_mode,
            player_color: game.player_color
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// @route   GET /api/games/:id/analyze
// @desc    Get detailed move-by-move evaluation and ideal moves
router.get('/:id/analyze', auth, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        
        // Let python handle the analysis
        const pythonResponse = await axios.post(`${PYTHON_API}/analyze`, {
            move_history: game.moves,
            human_color: game.player_color || 'w'
        });
        
        res.json(pythonResponse.data);
    } catch (err) {
        console.error('Analysis error:', err.message);
        res.status(500).json({ error: 'Failed to generate game analysis' });
    }
});

module.exports = router;