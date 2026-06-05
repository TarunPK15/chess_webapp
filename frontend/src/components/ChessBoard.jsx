import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { flushSync } from 'react-dom';
import { useSettings, BOARD_THEMES } from '../context/SettingsContext';

// ─── Promotion Picker ────────────────────────────────────────────────────────
const PROMO_PIECES = [
  { key: 'q', unicode: { w: '♕', b: '♛' }, label: 'Queen'  },
  { key: 'r', unicode: { w: '♖', b: '♜' }, label: 'Rook'   },
  { key: 'b', unicode: { w: '♗', b: '♝' }, label: 'Bishop' },
  { key: 'n', unicode: { w: '♘', b: '♞' }, label: 'Knight' },
];

function PromotionModal({ color, onSelect, onCancel, pieceSet }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(8, 11, 18, 0.85)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
      zIndex: 200,
      gap: '12px',
    }}>
      <p style={{
        color: '#fff', fontSize: '14px', fontWeight: 700,
        letterSpacing: '0.15em', fontFamily: 'var(--font-heading)',
        marginBottom: '4px',
      }}>
        PROMOTE PAWN
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        {PROMO_PIECES.map(({ key, unicode, label }) => (
          <button
            key={key}
            title={label}
            onClick={() => onSelect(key)}
            style={{
              width: '80px', height: '80px',
              borderRadius: '12px',
              border: '2px solid rgba(16,185,129,0.4)',
              background: 'rgba(16,185,129,0.08)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.15s',
              color: '#fff',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(16,185,129,0.25)';
              e.currentTarget.style.borderColor = 'var(--emerald)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(16,185,129,0.08)';
              e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)';
              e.currentTarget.style.transform = '';
            }}
          >
            {pieceSet === 'merida' ? (
              <div style={{
                width: '52px', height: '52px',
                backgroundImage: `url(/pieces/merida/${color}${key.toUpperCase()}.svg)`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }} />
            ) : (
              <span style={{
                fontSize: '42px', lineHeight: 1,
                color: color === 'w' ? '#fff' : '#1e293b',
                textShadow: color === 'w' ? '0 0 3px #000' : '0 0 3px #fff',
              }}>
                {unicode[color]}
              </span>
            )}
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.05em' }}>
              {label.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        style={{
          marginTop: '4px',
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
          fontSize: '12px', letterSpacing: '0.08em',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

export default function ChessBoard({ 
  initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 
  isEngineThinking = false,
  boardOrientation = 'white',   // 'white' | 'black'
  onMove = (move) => console.log('Move made:', move),
  externalSquareStyles = {},
}) {
  const { boardTheme, pieceSet } = useSettings();
  const themeColors = BOARD_THEMES[boardTheme] || BOARD_THEMES['green'];

  const [game, setGame] = useState(() => new Chess(initialFen));
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [lastMove, setLastMove] = useState(null);

  // Pending promotion: { from, to, gameCopy } — awaiting user piece choice
  const [pendingPromotion, setPendingPromotion] = useState(null);

  // When the engine makes a move, the parent updates initialFen.
  // We need to sync our chess.js game to the new FEN.
  useEffect(() => {
    // Only sync if the FEN actually changed and represents a different position
    try {
      const currentFen = game.fen();
      // Compare board part only (ignore fullmove/halfmove counters for display)
      const currentBoard = currentFen.split(' ').slice(0, 2).join(' ');
      const incomingBoard = initialFen.split(' ').slice(0, 2).join(' ');

      if (currentBoard !== incomingBoard) {
        const newGame = new Chess(initialFen);
        setGame(newGame);
        setOptionSquares({});
        setMoveFrom('');
        setPendingPromotion(null);
      }
    } catch (e) {
      // FEN might be invalid during transition — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFen]);

  // ─── HIGHLIGHT LEGAL MOVES ──────────────────────────────────────────────
  function getMoveOptions(square) {
    try {
      const moves = game.moves({ square, verbose: true });
      if (moves.length === 0) {
        setOptionSquares({});
        return false;
      }

      const newSquares = {};
      moves.forEach((m) => {
        const isCapture = game.get(m.to)?.color !== game.get(square)?.color && game.get(m.to);
        newSquares[m.to] = {
          backgroundImage: isCapture
            ? 'radial-gradient(circle, rgba(255,60,60,.6) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(16,185,129,.5) 28%, transparent 28%)',
          borderRadius: '50%',
        };
      });

      newSquares[square] = { backgroundColor: 'rgba(16, 185, 129, 0.25)' };
      setOptionSquares(newSquares);
      return true;
    } catch (e) {
      setOptionSquares({});
      return false;
    }
  }

  // ─── Block moves if it's not the player's turn ──────────────────────────
  function isPlayerTurn() {
    const playerSide = boardOrientation === 'black' ? 'b' : 'w';
    return game.turn() === playerSide;
  }

  // ─── Detect promotion move ───────────────────────────────────────────────
  function isPromotionMove(from, to) {
    const piece = game.get(from);
    if (!piece || piece.type !== 'p') return false;
    // White pawn moving to rank 8, or black pawn moving to rank 1
    const toRank = parseInt(to[1]);
    return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
  }

  // ─── Called when user selects a promotion piece ─────────────────────────
  function handlePromotionSelect(promotionPiece) {
    if (!pendingPromotion) return;
    const { from, to, gameCopy } = pendingPromotion;
    try {
      const move = gameCopy.move({ from, to, promotion: promotionPiece });
      if (move) {
        setGame(gameCopy);
        setMoveFrom('');
        setOptionSquares({});
        setLastMove({ from: move.from, to: move.to });
        onMove(move);
      }
    } catch { /* invalid — just close */ }
    setPendingPromotion(null);
  }

  function handlePromotionCancel() {
    setPendingPromotion(null);
    setMoveFrom('');
    setOptionSquares({});
  }

  // ─── Apply a move (shared by click and drag) ─────────────────────────────
  function applyMove(from, to) {
    const gameCopy = new Chess(game.fen());

    // Check for promotion first — without committing
    if (isPromotionMove(from, to)) {
      // Validate the target square is reachable (try with queen as probe)
      try {
        const probe = new Chess(game.fen());
        const testMove = probe.move({ from, to, promotion: 'q' });
        if (!testMove) return false;
      } catch {
        return false;
      }
      // Store pending and show modal
      setPendingPromotion({ from, to, gameCopy });
      setMoveFrom('');
      setOptionSquares({});
      return true; // consumed
    }

    // Normal move
    try {
      const move = gameCopy.move({ from, to, promotion: 'q' });
      if (move) {
        setGame(gameCopy);
        setMoveFrom('');
        setOptionSquares({});
        setLastMove({ from: move.from, to: move.to });
        onMove(move);
        return true;
      }
    } catch { /* fall through */ }
    return false;
  }

  // ─── DRAG: PIECE GRAB ────────────────────────────────────────────────────
  function onPieceDragBegin(piece, sourceSquare) {
    if (isEngineThinking || !isPlayerTurn()) return;
    flushSync(() => {
      const hasMoveOptions = getMoveOptions(sourceSquare);
      if (hasMoveOptions) setMoveFrom(sourceSquare);
    });
  }

  // ─── DRAG: PIECE RELEASE (no-op or off-board) ────────────────────────────
  function onPieceDragEnd() {
    setOptionSquares({});
    setMoveFrom('');
  }

  // ─── CLICK TO MOVE ───────────────────────────────────────────────────────
  function onSquareClick(square) {
    if (isEngineThinking || !isPlayerTurn() || pendingPromotion) return;

    if (!moveFrom) {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    if (square === moveFrom) {
      setMoveFrom('');
      setOptionSquares({});
      return;
    }

    const moved = applyMove(moveFrom, square);
    if (!moved) {
      // Try selecting the clicked square as new source
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      else { setMoveFrom(''); setOptionSquares({}); }
    }
  }

  // ─── DRAG AND DROP ────────────────────────────────────────────────────────
  function onDrop(sourceSquare, targetSquare) {
    if (isEngineThinking || !isPlayerTurn()) return false;
    return applyMove(sourceSquare, targetSquare);
  }

  const customSquareStyles = {
    ...externalSquareStyles,
    ...(lastMove && {
      [lastMove.from]: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
      [lastMove.to]:   { backgroundColor: 'rgba(16, 185, 129, 0.3)' },
    }),
    ...optionSquares,
  };

  const getUnicodePieces = () => {
    const unicodeMap = {
      wP: '♙', wN: '♘', wB: '♗', wR: '♖', wQ: '♕', wK: '♔',
      bP: '♟', bN: '♞', bB: '♝', bR: '♜', bQ: '♛', bK: '♚'
    };
    const pieces = {};
    Object.keys(unicodeMap).forEach(p => {
      pieces[p] = ({ squareWidth }) => (
        <div style={{
          width: squareWidth, height: squareWidth,
          fontSize: squareWidth * 0.75,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: p.startsWith('w') ? '#fff' : '#000',
          textShadow: p.startsWith('w') ? '0px 0px 2px #000' : '0px 0px 2px #fff',
          cursor: 'grab'
        }}>
          {unicodeMap[p]}
        </div>
      );
    });
    return pieces;
  };

  const getMeridaPieces = () => {
    const pieces = {};
    ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'].forEach(p => {
      pieces[p] = ({ squareWidth }) => (
        <div style={{
          width: squareWidth, height: squareWidth,
          backgroundImage: `url(/pieces/merida/${p}.svg)`,
          backgroundSize: '100%',
          cursor: 'grab'
        }} />
      );
    });
    return pieces;
  };

  // Determine the promotion piece color based on whose turn it is
  const promotingColor = pendingPromotion
    ? (boardOrientation === 'black' ? 'b' : 'w')
    : 'w';

  return (
    <div style={{
      position: 'relative',
      width: '600px', height: '600px',
      border: '3px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      flexShrink: 0,
    }}>
      <Chessboard
        position={game.fen()}
        boardOrientation={boardOrientation}
        onPieceDrop={onDrop}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDragEnd={onPieceDragEnd}
        onSquareClick={onSquareClick}
        customSquareStyles={customSquareStyles}
        boardWidth={600}
        animationDuration={180}
        customDarkSquareStyle={{ backgroundColor: themeColors.dark }}
        customLightSquareStyle={{ backgroundColor: themeColors.light }}
        customPieces={pieceSet === 'unicode' ? getUnicodePieces() : getMeridaPieces()}
        arePiecesDraggable={!isEngineThinking && isPlayerTurn() && !pendingPromotion}
      />

      {/* Promotion picker overlay */}
      {pendingPromotion && (
        <PromotionModal
          color={promotingColor}
          onSelect={handlePromotionSelect}
          onCancel={handlePromotionCancel}
          pieceSet={pieceSet}
        />
      )}

      {/* Engine thinking overlay */}
      {isEngineThinking && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(8, 11, 18, 0.72)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)', zIndex: 100,
        }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '20px' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid rgba(16,185,129,0.2)',
              animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '8px', borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: 'var(--emerald)',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '28px', borderRadius: '50%',
              background: 'var(--emerald)',
              animation: 'pulse 1s ease-in-out infinite',
              boxShadow: '0 0 20px rgba(16,185,129,0.8)',
            }} />
          </div>
          <p style={{
            color: '#fff', fontSize: '14px', fontWeight: 700,
            letterSpacing: '0.25em', fontFamily: 'var(--font-heading)',
          }}>
            STONKFISH
          </p>
          <p style={{
            color: 'var(--emerald)', fontSize: '11px',
            letterSpacing: '0.15em', marginTop: '6px',
            fontFamily: 'var(--font-mono)',
          }}>
            CALCULATING...
          </p>
        </div>
      )}

      {/* CSS for overlay animations */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}