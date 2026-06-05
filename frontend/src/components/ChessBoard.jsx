import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { flushSync } from 'react-dom';
import { useSettings, BOARD_THEMES } from '../context/SettingsContext';

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
  // Determine which side's pieces the player can move:
  // boardOrientation 'white' → player moves white pieces (turn === 'w')
  // boardOrientation 'black' → player moves black pieces (turn === 'b')
  function isPlayerTurn() {
    const playerSide = boardOrientation === 'black' ? 'b' : 'w';
    return game.turn() === playerSide;
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
    if (isEngineThinking || !isPlayerTurn()) return;

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

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({ from: moveFrom, to: square, promotion: 'q' });
      if (move) {
        setGame(gameCopy);
        setMoveFrom('');
        setOptionSquares({});
        setLastMove({ from: move.from, to: move.to });
        onMove(move);
      } else {
        // Try selecting the clicked square as new source
        const hasMoveOptions = getMoveOptions(square);
        if (hasMoveOptions) setMoveFrom(square);
        else { setMoveFrom(''); setOptionSquares({}); }
      }
    } catch {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      else { setMoveFrom(''); setOptionSquares({}); }
    }
  }

  // ─── DRAG AND DROP ────────────────────────────────────────────────────────
  function onDrop(sourceSquare, targetSquare) {
    if (isEngineThinking || !isPlayerTurn()) return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (move) {
        setGame(gameCopy);
        setOptionSquares({});
        setMoveFrom('');
        setLastMove({ from: move.from, to: move.to });
        onMove(move);
        return true;
      }
    } catch {
      setOptionSquares({});
      setMoveFrom('');
    }
    return false;
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
        arePiecesDraggable={!isEngineThinking && isPlayerTurn()}
      />

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