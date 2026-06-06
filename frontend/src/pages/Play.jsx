import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import apiClient from '../services/apiClient';
import ChessBoard from '../components/ChessBoard';
import useAuthStore from '../store/useAuthStore';

// ─── Starting position in StonkFish internal format ─────────────────────────
const STARTING_GAME_STATE = {
  white: {
    WP1:[1,2],WP2:[2,2],WP3:[3,2],WP4:[4,2],
    WP5:[5,2],WP6:[6,2],WP7:[7,2],WP8:[8,2],
    WR1:[1,1],WN1:[2,1],WB1:[3,1],WQ1:[4,1],
    WK1:[5,1],WB2:[6,1],WN2:[7,1],WR2:[8,1],
  },
  black: {
    BP1:[1,7],BP2:[2,7],BP3:[3,7],BP4:[4,7],
    BP5:[5,7],BP6:[6,7],BP7:[7,7],BP8:[8,7],
    BR1:[1,8],BN1:[2,8],BB1:[3,8],BQ1:[4,8],
    BK1:[5,8],BB2:[6,8],BN2:[7,8],BR2:[8,8],
  },
  turn: 'w',
  move_history: [],
  halfmove_clock: 0,
  fullmove_number: 1,
  position_counts: {},
  en_passant_target: null,
  result: '*',
  draw_offer: null,
};

// ─── Chess.js algebraic → StonkFish [col, row] ──────────────────────────────
const FILE_TO_COL = { a:1, b:2, c:3, d:4, e:5, f:6, g:7, h:8 };

function squareToSF(sq) {
  // e.g. 'e4' → [5, 4]
  return [FILE_TO_COL[sq[0]], parseInt(sq[1])];
}

function sfSquareToChessjs(col, row) {
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return `${FILES[col - 1]}${row}`;
}

// Find the StonkFish piece name at a given [col, row] in the current sfState
function findPieceAt(sfState, col, row, color) {
  const dict = color === 'w' ? sfState.white : sfState.black;
  for (const [name, pos] of Object.entries(dict)) {
    if (pos[0] === col && pos[1] === row) return name;
  }
  return null;
}

export default function Play() {
  const { game_id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const currentUserId = user?.userId;

  // ── Game meta (loaded from DB) ─────────────────────────────────────────────
  const [currentGameId, setCurrentGameId]   = useState(game_id || null);
  const [playerColor,   setPlayerColor]     = useState('w');       // 'w' | 'b'
  const [gameType,      setGameType]         = useState('bot');     // 'bot' | 'pvp'
  const [engineMode,    setEngineMode]       = useState('ml3');     // display only
  const [engineDepth,   setEngineDepth]      = useState(3);

  // ── Board / move state ────────────────────────────────────────────────────
  // sfState: the StonkFish internal dict — passed to every API call
  const [sfState,       setSfState]          = useState(STARTING_GAME_STATE);
  // fen: what chess.js / react-chessboard uses for rendering
  const [fen,           setFen]              = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [evalScore,        setEvalScore]         = useState(0.0);
  const [moveHistory,      setMoveHistory]       = useState([]);
  const [externalLastMove, setExternalLastMove]  = useState(null);

  // ── Game-end state ────────────────────────────────────────────────────────
  const [gameEnded,  setGameEnded]  = useState(false);
  const [endStatus,  setEndStatus]  = useState({ result: '', moveCount: 0 });

  const socketRef    = useRef(null);
  const sfStateRef   = useRef(sfState);  // always-current ref so socket callbacks see latest state

  // Keep sfStateRef in sync with sfState
  useEffect(() => {
    sfStateRef.current = sfState;
  }, [sfState]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handle incoming engine_move events (from WebSocket)
  // ─────────────────────────────────────────────────────────────────────────
  const handleEngineMove = useCallback((data) => {
    console.log('🤖 Engine move received:', data);

    // Update the StonkFish internal state
    if (data.updated_state) {
      if (data.piece && data.target) {
        const sfDict = sfStateRef.current.white[data.piece] ? sfStateRef.current.white : sfStateRef.current.black;
        const oldPos = sfDict[data.piece];
        if (oldPos) {
          setExternalLastMove({
            from: sfSquareToChessjs(oldPos[0], oldPos[1]),
            to: sfSquareToChessjs(data.target[0], data.target[1])
          });
        }
      }
      setSfState(data.updated_state);
      sfStateRef.current = data.updated_state;
      // Build the FEN from updated_state so ChessBoard syncs
      const newFen = sfStateToFen(data.updated_state);
      setFen(newFen);
    } else if (data.new_fen) {
      setFen(data.new_fen);
    }

    if (data.eval_score !== undefined) setEvalScore(data.eval_score);
    if (data.history)                  setMoveHistory(data.history);

    setIsEngineThinking(false);

    if (data.is_checkmate) {
      const moveCount = data.history?.length || 0;
      setEndStatus({ result: 'Loss — Engine Checkmate', moveCount });
      setGameEnded(true);
    } else if (data.is_stalemate) {
      const moveCount = data.history?.length || 0;
      setEndStatus({ result: 'Draw — Stalemate', moveCount });
      setGameEnded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Utility: build a FEN from a StonkFish state dict
  // (mirrors the Python to_fen() logic in JavaScript)
  // ─────────────────────────────────────────────────────────────────────────
  function sfStateToFen(state) {
    try {
      const FILES = 'abcdefgh';
      const FEN_MAP = {
        WP:'P', WR:'R', WN:'N', WB:'B', WQ:'Q', WK:'K',
        BP:'p', BR:'r', BN:'n', BB:'b', BQ:'q', BK:'k',
      };
      const grid = Array.from({ length: 8 }, () => Array(8).fill(''));

      const place = (dict) => {
        for (const [name, pos] of Object.entries(dict)) {
          const prefix = name.slice(0, 2);
          const col = pos[0] - 1; // 0-indexed
          const row = 8 - pos[1]; // 0-indexed from top
          if (row >= 0 && row < 8 && col >= 0 && col < 8) {
            grid[row][col] = FEN_MAP[prefix] || '';
          }
        }
      };
      place(state.white || {});
      place(state.black || {});

      const rows = grid.map(row => {
        let s = ''; let empty = 0;
        for (const sq of row) {
          if (!sq) { empty++; }
          else { if (empty) { s += empty; empty = 0; } s += sq; }
        }
        if (empty) s += empty;
        return s;
      });

      const turn = state.turn || 'w';
      let ep = '-';
      if (state.en_passant_target) {
        const [c, r] = state.en_passant_target;
        ep = `${FILES[c-1]}${r}`;
      }
      let castling = '';
      const mh = state.move_history || [];
      const hasMoved = (p) => mh.some(m => m.startsWith(p + '_'));

      const wkPos = state.white?.WK1;
      if (wkPos && wkPos[0] === 5 && wkPos[1] === 1 && !hasMoved('WK1')) {
        const wr2Pos = state.white?.WR2;
        if (wr2Pos && wr2Pos[0] === 8 && wr2Pos[1] === 1 && !hasMoved('WR2')) castling += 'K';
        const wr1Pos = state.white?.WR1;
        if (wr1Pos && wr1Pos[0] === 1 && wr1Pos[1] === 1 && !hasMoved('WR1')) castling += 'Q';
      }

      const bkPos = state.black?.BK1;
      if (bkPos && bkPos[0] === 5 && bkPos[1] === 8 && !hasMoved('BK1')) {
        const br2Pos = state.black?.BR2;
        if (br2Pos && br2Pos[0] === 8 && br2Pos[1] === 8 && !hasMoved('BR2')) castling += 'k';
        const br1Pos = state.black?.BR1;
        if (br1Pos && br1Pos[0] === 1 && br1Pos[1] === 8 && !hasMoved('BR1')) castling += 'q';
      }
      
      if (!castling) castling = '-';

      const hm  = state.halfmove_clock || 0;
      const fm  = state.fullmove_number || 1;
      return `${rows.join('/')} ${turn} ${castling} ${ep} ${hm} ${fm}`;
    } catch {
      return fen; // fallback: keep current fen unchanged
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Trigger the engine to make its opening move (when human plays black)
  // ─────────────────────────────────────────────────────────────────────────
  const triggerEngineOpeningMove = useCallback(async (gameId, state) => {
    setIsEngineThinking(true);
    try {
      await apiClient.post(`/games/${gameId}/engine-move-only`, {
        game_state: state,
      });
      // Response comes via WebSocket engine_move event
    } catch (err) {
      console.error('Engine opening move failed:', err);
      setIsEngineThinking(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Mount: init game session + WebSocket
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const initGame = async () => {
      try {
        let activeId    = game_id;
        let color       = 'w';
        let gType       = 'bot';
        let mode        = 'ml3';
        let depth       = 3;
        let initialState = STARTING_GAME_STATE;

        if (!activeId) {
          // This branch only fires when navigating to /play directly (not from PlayModal)
          // PlayModal always navigates to /play/:id so this is a fallback
          const response = await apiClient.post('/games', {
            game_type: 'bot',
            engine_mode: 'ml3',
            engine_depth: 3,
            player_color: 'w',
          });
          activeId = response.data.game_id || response.data._id;
          color    = response.data.player_color || 'w';
          gType    = response.data.game_type || 'bot';
          mode     = response.data.engine_mode  || 'ml3';
          depth    = response.data.engine_depth || 3;
          setCurrentGameId(activeId);
          navigate(`/play/${activeId}`, { replace: true });
        } else {
          // Fetch the game's settings from DB to display correctly
          const gameRes = await apiClient.get(`/games/${activeId}`);
          const g = gameRes.data;
          gType = g.game_type     || 'bot';
          mode  = g.engine_mode   || 'ml3';
          depth = g.engine_depth  || 3;

          // ── Determine player color ──────────────────────────────────────
          if (gType === 'pvp') {
            // For PvP, derive color from which player slot this user fills
            const whiteId = g.white_player_id?._id || g.white_player_id?.toString?.() || g.white_player_id;
            color = whiteId?.toString() === currentUserId?.toString() ? 'w' : 'b';
          } else {
            color = g.player_color || 'w';
          }

          if (g.current_state) {
            initialState = g.current_state;
          }
          if (g.moves && g.moves.length > 0) {
            setMoveHistory(g.moves);
          }
          if (g.result !== 'abandoned') {
            setGameEnded(true);
            setEndStatus({ result: g.result === 'draw' ? 'Draw' : g.result === 'win' ? 'You Won!' : 'Loss', moveCount: g.moves?.length || 0 });
          }
        }

        setPlayerColor(color);
        setGameType(gType);
        setEngineMode(mode);
        setEngineDepth(depth);

        // ── WebSocket setup ─────────────────────────────────────────────
        const socketUrl = import.meta.env.VITE_API_URL 
          ? import.meta.env.VITE_API_URL.replace('/api', '') 
          : 'http://localhost:5000';

        // Connect Socket.io to the live Cloud Server
        const socket = io(socketUrl);

        socket.on('connect', () => {
          console.log(`📡 Connected to WebSocket. Joining room: ${activeId}`);
          socket.emit('join_game', activeId);
        });

        socket.on('engine_move', handleEngineMove);

        // ── PvP: listen for opponent's move and update own board ────────
        socket.on('pvp_move', (data) => {
          console.log('♟ PvP move received:', data);
          if (data.updated_state) {
            if (data.piece && data.target) {
              const sfDict = sfStateRef.current.white[data.piece] ? sfStateRef.current.white : sfStateRef.current.black;
              const oldPos = sfDict[data.piece];
              if (oldPos) {
                setExternalLastMove({
                  from: sfSquareToChessjs(oldPos[0], oldPos[1]),
                  to: sfSquareToChessjs(data.target[0], data.target[1])
                });
              }
            }
            setSfState(data.updated_state);
            sfStateRef.current = data.updated_state;
            setFen(sfStateToFen(data.updated_state));
          }
          if (data.move_str) {
            setMoveHistory(prev => [...prev, data.move_str]);
          }
          setIsEngineThinking(false);
          // Belt-and-suspenders: if checkmate/stalemate flags arrive on pvp_move
          // (before game_over fires), handle them here too
          if (data.is_checkmate) {
            setGameEnded(true);
            // The sender of this move won — if this event came from the opponent,
            // that means WE lost. game_over event will carry the authoritative result.
          } else if (data.is_stalemate) {
            setGameEnded(true);
          }
        });

        // ── PvP: listen for game over ───────────────────────────────────
        socket.on('game_over', (data) => {
          const moveCount = sfStateRef.current?.move_history?.length || 0;
          let resultLabel;
          if (data.reason === 'stalemate') {
            resultLabel = 'Draw — Stalemate';
          } else if (data.reason === 'checkmate') {
            // winner_id is the user who delivered checkmate
            const iWon = data.winner_id && data.winner_id.toString() === currentUserId?.toString();
            resultLabel = iWon ? '🏆 You Won — Checkmate!' : '☠ Defeat — Checkmate';
          } else if (data.reason === 'forfeit') {
            const iWon = data.by && data.by.toString() !== currentUserId?.toString();
            resultLabel = iWon ? '🏆 You Won — Opponent Resigned' : 'Loss — Resigned';
          } else {
            resultLabel = data.result || 'Game Over';
          }
          setGameEnded(true);
          setEndStatus({ result: resultLabel, moveCount });
        });

        // ── If human plays black, engine moves first ────────────────────
        // Only trigger if no moves have been played
        if (color === 'b' && initialState === STARTING_GAME_STATE) {
          // Small delay so socket room join is registered first
          setTimeout(() => triggerEngineOpeningMove(activeId, initialState), 600);
        }

        // ── Resume State ────────────────────
        sfStateRef.current = initialState;
        setFen(sfStateToFen(initialState));

      } catch (error) {
        console.error('Failed to initialize game environment:', error);
      }
    };

    initGame();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game_id]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handle human moves
  // ─────────────────────────────────────────────────────────────────────────
  const handlePlayerMove = async (move) => {
    setIsEngineThinking(true);
    setExternalLastMove({ from: move.from, to: move.to });

    // Optimistic move history update
    setMoveHistory(prev => [...prev, move.san]);

    // Translate chess.js move to StonkFish format
    const [fromCol, fromRow] = squareToSF(move.from);
    const [toCol,   toRow]   = squareToSF(move.to);

    // Find which StonkFish piece was at the source square
    // The moving color is the player's color
    const movingColor = playerColor; // 'w' or 'b'
    const sfPiece = findPieceAt(sfStateRef.current, fromCol, fromRow, movingColor);

    if (!sfPiece) {
      console.error(`Could not find StonkFish piece at ${move.from} ([${fromCol},${fromRow}])`);
      setIsEngineThinking(false);
      return;
    }

    const sfTarget = [toCol, toRow];

    try {
      const res = await apiClient.post(`/games/${currentGameId}/move`, {
        game_state: sfStateRef.current,
        piece:      sfPiece,
        target:     sfTarget,
      });

      // For PvP: update own state immediately from the validated response.
      // The opponent will receive the update via the pvp_move WebSocket event.
      if (gameType === 'pvp') {
        // The backend returns the validated (post-move) state directly in the HTTP response
        // But we need the updated_state. It is emitted via socket — we also need it here.
        // The pvp_move socket event fires to ALL in the room including sender,
        // so our own pvp_move listener will also fire and update our state.
        setIsEngineThinking(false);
      }
      // For bot games, the engine_move socket event will fire and update state + clear thinking.
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message;
      console.error('Error submitting player move:', errMsg);
      setIsEngineThinking(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // New game, Resign, Draw
  // ─────────────────────────────────────────────────────────────────────────
  const startNewGame = () => {
    navigate('/dashboard');
  };

  const handleResign = async () => {
    if (gameEnded) return;
    if (!window.confirm("Are you sure you want to resign?")) return;
    try {
      await apiClient.post(`/games/${currentGameId}/forfeit`);
      setGameEnded(true);
      setEndStatus({ result: 'Loss — Resigned', moveCount: moveHistory.length });
    } catch (err) {
      console.error('Failed to resign', err);
    }
  };

  const handleDraw = async () => {
    if (gameEnded) return;
    if (!window.confirm("Offer a draw?")) return;
    try {
      await apiClient.post(`/games/${currentGameId}/draw`);
      setGameEnded(true);
      setEndStatus({ result: 'Draw — Agreed', moveCount: moveHistory.length });
    } catch (err) {
      console.error('Failed to offer draw', err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Eval bar
  // ─────────────────────────────────────────────────────────────────────────
  const clampedEval    = Math.max(-10, Math.min(10, evalScore));
  const whitePercentage = ((clampedEval + 10) / 20) * 100;

  const engineLabel = engineMode.startsWith('ml')
    ? `🤖 ML StonkFish (depth ${engineDepth})`
    : `⚡ Greedy StonkFish (depth ${engineDepth})`;

  const isML = engineMode.startsWith('ml');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px', userSelect: 'none',
    }}>

      {/* ── TOP PANEL ─────────────────────────────────────────────────── */}
      <div className="flex-col-mobile" style={{
        width: '860px', maxWidth: '100%',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-nav)',
        border: '1px solid var(--border)',
        borderRadius: '14px', padding: '12px 18px', marginBottom: '16px',
        gap: '12px',
      }}>
        {/* Left: engine badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            to="/dashboard"
            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '22px', lineHeight: 1 }}
            title="Back to Dashboard"
          >♟</Link>

          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
            textTransform: 'uppercase', letterSpacing: '0.07em',
            background: isML ? 'var(--emerald-dim)' : 'var(--amber-dim)',
            color:      isML ? 'var(--emerald)'     : 'var(--amber)',
            border:    `1px solid ${isML ? 'var(--emerald-glow)' : 'rgba(245,158,11,0.3)'}`,
          }}>
            {engineLabel}
          </span>

          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}>
            You play as {playerColor === 'w' ? '♙ White' : '♟ Black'}
          </span>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            to="/dashboard"
            style={{
              padding: '7px 14px', borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text-secondary)', textDecoration: 'none',
              fontSize: '12px', fontWeight: 500,
            }}
          >
            ← Dashboard
          </Link>
          {!gameEnded && (
            <>
              {gameType === 'pvp' && (
                <button
                  onClick={handleDraw}
                  style={{
                    padding: '7px 14px', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-secondary)', fontSize: '12px',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Offer Draw
                </button>
              )}
              <button
                onClick={handleResign}
                style={{
                  padding: '7px 14px', borderRadius: '8px',
                  border: '1px solid var(--red-dim)',
                  background: 'var(--red-dim)',
                  color: 'var(--red)', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                Resign
              </button>
            </>
          )}
          <button
            onClick={startNewGame}
            style={{
              padding: '7px 14px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)', fontSize: '12px',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            New Game
          </button>
        </div>
      </div>

      {/* ── MAIN GAME ZONE ────────────────────────────────────────────── */}
      <div className="game-zone" style={{
        display: 'flex', gap: '14px', alignItems: 'stretch',
        justifyContent: 'center', height: '600px',
        width: '860px', maxWidth: '100%',
      }}>

        {/* EVAL BAR (Left/Top on mobile) */}
        <div className="eval-bar-mobile" style={{
          width: '18px', flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Black zone (top/left) */}
          <div style={{
            width: '100%', background: '#1e293b',
            transition: 'all 0.5s ease',
            flexBasis: `${100 - whitePercentage}%`,
          }} />
          {/* White zone (bottom/right) */}
          <div style={{
            width: '100%', background: '#f8fafc',
            transition: 'all 0.5s ease',
            flexBasis: `${whitePercentage}%`,
            position: 'relative',
          }}>
          </div>
        </div>

        {/* CHESSBOARD (Center) */}
        <ChessBoard
          key={currentGameId}
          initialFen={fen}
          isEngineThinking={gameType === 'pvp' ? false : isEngineThinking}
          boardOrientation={playerColor === 'b' ? 'black' : 'white'}
          onMove={handlePlayerMove}
          externalLastMove={externalLastMove}
          onFenUpdate={(newFen) => {
            // ChessBoard tracks its own chess.js state; we track sfState separately
            // No need to sync fen up from ChessBoard — sfState drives source of truth
          }}
        />

        {/* MOVE HISTORY (Right/Bottom on mobile) */}
        <div className="game-zone-sidebar" style={{
          width: '210px', flexShrink: 0,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <h3 style={{
            color: 'var(--text-muted)', fontWeight: 700, fontSize: '10px',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            paddingBottom: '10px', marginBottom: '10px',
          }}>
            Move Log
          </h3>
          <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {moveHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                No moves yet.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 6px' }}>
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                  <>
                    <span key={`w${i}`} style={{ color: 'var(--text-secondary)', padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{i + 1}.</span>{' '}
                      {moveHistory[i * 2]}
                    </span>
                    <span key={`b${i}`} style={{ color: 'var(--amber)', padding: '2px 0' }}>
                      {moveHistory[i * 2 + 1] || ''}
                    </span>
                  </>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── GAME END MODAL ─────────────────────────────────────────────── */}
      {gameEnded && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '36px', borderRadius: '20px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxWidth: '360px', width: '100%', textAlign: 'center',
            animation: 'scaleIn 0.25s ease',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>♛</div>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '28px',
              fontWeight: 900, margin: '0 0 6px',
            }}>Game Over</h2>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700,
              marginBottom: '24px',
              color: endStatus.result.includes('Loss') ? 'var(--red)'
                   : endStatus.result.includes('Draw') ? 'var(--amber)'
                   : 'var(--emerald)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {endStatus.result}
            </p>

            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
              padding: '16px', marginBottom: '20px',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Total Moves</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {endStatus.moveCount}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Opponent</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{engineLabel}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                to="/dashboard"
                style={{
                  flex: 1, padding: '11px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-secondary)', textDecoration: 'none',
                  fontSize: '14px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                Dashboard
              </Link>
              <button
                onClick={startNewGame}
                style={{
                  flex: 2, background: 'var(--emerald)', color: '#000',
                  border: 'none', padding: '11px', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                  transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                }}
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}