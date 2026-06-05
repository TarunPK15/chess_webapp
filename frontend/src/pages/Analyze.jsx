import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import ChessBoard from '../components/ChessBoard';
import ThemeToggle from '../components/ThemeToggle';

// ─── Utility: build a FEN from a StonkFish state dict ───────────────────────
const FILES = 'abcdefgh';
function sfStateToFen(state) {
  try {
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
    
    // Dynamically calculate castling rights from move history
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
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
}

function sfMoveToAlgebraic(piece, target) {
  if (!piece || !target) return '';
  const pieceType = piece[1]; // e.g. "P", "N", "B", "K", "Q", "R"
  const col = target[0];
  const row = target[1];
  const sq = `${FILES[col - 1]}${row}`;
  
  if (pieceType === 'P') return sq;
  return `${pieceType}${sq}`;
}

export default function Analyze() {
  const { game_id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showIdeal, setShowIdeal] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/games/${game_id}/analyze`);
        if (res.data.analysis) {
          setAnalysis(res.data.analysis);
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load game analysis. It may not be finished yet.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [game_id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        setShowIdeal(false);
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => Math.min(analysis.length - 1, prev + 1));
        setShowIdeal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analysis.length]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', flexDirection: 'column', gap: '20px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--border)', borderTop: '4px solid var(--emerald)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ color: 'var(--text-secondary)' }}>Analyzing Game...</h2>
      </div>
    );
  }

  if (error || analysis.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ color: 'var(--red)' }}>{error || "No analysis available"}</h2>
        <Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  const currentState = analysis[currentIndex];
  
  // Decide which state to show
  const activeState = (showIdeal && currentState.ideal_state) ? currentState.ideal_state : currentState.state;
  const fen = sfStateToFen(activeState);
  
  const clampedEval = Math.max(-10, Math.min(10, currentState.eval_score || 0));
  const whitePercentage = ((clampedEval + 10) / 20) * 100;

  // Calculate highlighted squares
  let highlightSquares = {};
  function getSquare(col, row) {
    return `${FILES[col - 1]}${row}`;
  }

  if (showIdeal && currentState.ideal_move) {
    const [piece, target] = currentState.ideal_move;
    const isWhite = piece.startsWith('W');
    const prevPos = isWhite ? currentState.state.white[piece] : currentState.state.black[piece];
    if (prevPos) {
      const fromSq = getSquare(prevPos[0], prevPos[1]);
      const toSq = getSquare(target[0], target[1]);
      highlightSquares[fromSq] = { backgroundColor: 'rgba(59, 130, 246, 0.4)' }; // Blue
      highlightSquares[toSq] = { backgroundColor: 'rgba(59, 130, 246, 0.7)' };
    }
  } else if (currentIndex > 0 && !showIdeal) {
    const prevState = analysis[currentIndex - 1].state;
    const [piece, target] = currentState.move_played;
    const isWhite = piece.startsWith('W');
    const prevPos = isWhite ? prevState.white[piece] : prevState.black[piece];
    if (prevPos) {
      const fromSq = getSquare(prevPos[0], prevPos[1]);
      const toSq = getSquare(target[0], target[1]);
      highlightSquares[fromSq] = { backgroundColor: 'rgba(16, 185, 129, 0.4)' }; // Emerald
      highlightSquares[toSq] = { backgroundColor: 'rgba(16, 185, 129, 0.7)' };
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px', userSelect: 'none',
    }}>
      {/* ── TOP PANEL ─────────────────────────────────────────────────── */}
      <div style={{
        width: '900px', maxWidth: '100%',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-nav)',
        border: '1px solid var(--border)',
        borderRadius: '14px', padding: '12px 18px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/dashboard" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '22px', lineHeight: 1 }}>♟</Link>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Game Analysis</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <ThemeToggle />
          <Link to="/dashboard" style={{
            padding: '7px 14px', borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)', textDecoration: 'none',
            fontSize: '12px', fontWeight: 500,
          }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '14px', alignItems: 'stretch',
        justifyContent: 'center',
        width: '900px', maxWidth: '100%',
      }}>
        {/* EVAL BAR */}
        <div style={{
          width: '18px', flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Black portion grows downwards */}
          <div style={{
            flex: `${100 - whitePercentage}`,
            background: '#111',
            transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
          {/* White portion fills the rest */}
          <div style={{
            flex: `${whitePercentage}`,
            background: '#fff',
            transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        {/* BOARD */}
        <div style={{
          width: '600px', height: '600px',
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}>
          <ChessBoard
            initialFen={fen}
            playerColor="w"
            onMove={() => {}}
            draggable={false}
            externalSquareStyles={highlightSquares}
          />
        </div>

        {/* ANALYSIS PANEL */}
        <div style={{
          flexGrow: 1,
          height: '600px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Score Header */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Evaluation</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: currentState.eval_score > 0 ? 'var(--emerald)' : (currentState.eval_score < 0 ? 'var(--red)' : 'var(--text-primary)') }}>
              {currentState.eval_score > 0 ? '+' : ''}{currentState.eval_score?.toFixed(2)}
            </div>
            
            {currentState.ideal_move && (
              <div 
                onClick={() => setShowIdeal(!showIdeal)}
                style={{ 
                  marginTop: '12px', padding: '12px', 
                  background: showIdeal ? 'var(--emerald)' : 'var(--emerald-dim)', 
                  border: '1px solid var(--emerald-glow)', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{ fontSize: '11px', color: showIdeal ? '#fff' : 'var(--emerald)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Ideal Move {showIdeal ? '(Viewing)' : '(Click to View)'}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: showIdeal ? '#fff' : 'var(--text-primary)' }}>
                  {sfMoveToAlgebraic(currentState.ideal_move[0], currentState.ideal_move[1])}
                </div>
              </div>
            )}
          </div>

          {/* Timeline Scroll */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {analysis.map((step, idx) => (
              <div 
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowIdeal(false);
                }}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: idx === currentIndex ? 'var(--bg-surface)' : 'transparent',
                  border: `1px solid ${idx === currentIndex ? 'var(--border-strong)' : 'transparent'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '20px', fontFamily: 'var(--font-mono)' }}>
                    {idx === 0 ? '-' : idx}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: idx === currentIndex ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {idx === 0 ? 'Starting Position' : sfMoveToAlgebraic(step.move_played[0], step.move_played[1])}
                  </span>
                </div>
                {idx > 0 && (
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: step.eval_score > 0 ? 'var(--emerald)' : (step.eval_score < 0 ? 'var(--red)' : 'var(--text-muted)') }}>
                    {step.eval_score > 0 ? '+' : ''}{step.eval_score?.toFixed(1)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <button 
              onClick={() => {
                setCurrentIndex(Math.max(0, currentIndex - 1));
                setShowIdeal(false);
              }}
              disabled={currentIndex === 0}
              style={{
                padding: '8px 12px', borderRadius: '8px',
                border: '1px solid var(--border)',
                background: currentIndex === 0 ? 'var(--bg-base)' : 'var(--bg-card-hover)',
                color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontWeight: 600, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s', flex: 1, marginRight: '6px'
              }}
            >
              ◀ Prev
            </button>
            <button 
              onClick={() => {
                setCurrentIndex(Math.min(analysis.length - 1, currentIndex + 1));
                setShowIdeal(false);
              }}
              disabled={currentIndex === analysis.length - 1}
              style={{
                padding: '8px 12px', borderRadius: '8px',
                border: '1px solid var(--border)',
                background: currentIndex === analysis.length - 1 ? 'var(--bg-base)' : 'var(--bg-card-hover)',
                color: currentIndex === analysis.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontWeight: 600, cursor: currentIndex === analysis.length - 1 ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s', flex: 1, marginLeft: '6px'
              }}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
