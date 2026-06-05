import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useAuthStore from '../store/useAuthStore';
import apiClient from '../services/apiClient';
import PlayModal from '../components/PlayModal';
import ThemeToggle from '../components/ThemeToggle';
import SettingsModal from '../components/SettingsModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function ResultBadge({ result }) {
  const map = {
    win:       { label: 'W', ...{} },
    loss:      { label: 'L' },
    draw:      { label: 'D' },
    abandoned: { label: '—' },
  };
  const cfg = map[result] || map.abandoned;
  return (
    <span
      className={`badge-${result || 'abandoned'}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '28px', height: '28px', borderRadius: '6px',
        fontSize: '12px', fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, color, icon, delay = 0 }) {
  return (
    <div
      className="glass"
      style={{
        flex: 1, minWidth: '130px',
        padding: '20px',
        textAlign: 'center',
        animation: `fadeInUp 0.4s ease ${delay}s both`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = `0 8px 32px ${color}33`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div style={{ fontSize: '22px', marginBottom: '8px' }}>{icon}</div>
      <div style={{
        fontSize: '32px', fontWeight: 800,
        fontFamily: 'var(--font-heading)',
        color, lineHeight: 1,
        letterSpacing: '-1px',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

// ─── ChallengeToast ───────────────────────────────────────────────────────────
function ChallengeToast({ challenge, onAccept, onDecline }) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      zIndex: 2000,
      background: 'var(--bg-surface)',
      border: '1px solid var(--emerald)',
      borderRadius: 'var(--radius-md)',
      padding: '18px 20px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.2)',
      width: '320px',
      animation: 'slideDown 0.3s ease',
    }}>
      <p style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
        ⚔ Challenge Received!
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
        <strong style={{ color: 'var(--emerald)' }}>{challenge.sender_username}</strong> wants to play chess with you
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, padding: '8px' }}
          onClick={() => onAccept(challenge.challenge_id)}
        >
          Accept
        </button>
        <button
          className="btn btn-ghost"
          style={{ flex: 1, padding: '8px' }}
          onClick={() => onDecline(challenge.challenge_id)}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ games_played: 0, wins: 0, avg_moves: 0 });
  const [gameLog, setGameLog] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [pendingChallenge, setPendingChallenge] = useState(null);
  const socketRef = useRef(null);

  // ── Fetch user stats & game log ─────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingStats(true);
        const [lbRes, gamesRes] = await Promise.all([
          apiClient.get('/leaderboard'),
          apiClient.get('/games/my-games?limit=50'),
        ]);

        // Find current user in leaderboard for live stats
        const me = lbRes.data.find(u => u.username === user?.username);
        if (me) {
          setStats({
            games_played: me.games_played,
            wins: me.wins,
            avg_moves: Math.round(me.avg_moves) || 0,
            win_rate: Math.round(me.win_rate) || 0,
          });
        }
        setGameLog(gamesRes.data || []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchData();
  }, [user?.username]);

  // ── Socket.io — join user room for challenge notifications ───────────────
  useEffect(() => {
    if (!user) return;
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_user', user.userId);
    });

    socketRef.current.on('new_challenge', (data) => {
      setPendingChallenge(data);
    });

    socketRef.current.on('challenge_accepted', ({ game_id, color }) => {
      navigate(`/play/${game_id}`);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user, navigate]);

  const handleAcceptChallenge = async (challengeId) => {
    try {
      const res = await apiClient.post(`/challenges/${challengeId}/accept`);
      setPendingChallenge(null);
      navigate(`/play/${res.data.game_id}`);
    } catch (err) {
      console.error('Failed to accept challenge:', err);
      setPendingChallenge(null);
    }
  };

  const handleDeclineChallenge = () => {
    setPendingChallenge(null);
  };

  const losses = stats.games_played - stats.wins;
  const winRate = stats.games_played > 0 ? Math.round((stats.wins / stats.games_played) * 100) : 0;

  const [activeTab, setActiveTab] = useState('continue'); // 'continue' or 'previous'
  
  const continueGames = gameLog.filter(g => g.result === 'abandoned');
  const previousGames = gameLog.filter(g => g.result !== 'abandoned');
  
  const displayedGames = activeTab === 'continue' ? continueGames : previousGames;

  const PIECE_SYMBOLS = {
    w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
    b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 0%, rgba(16,185,129,0.04) 0%, transparent 50%), var(--bg-base)',
    }}>
      {/* ── Topbar ────────────────────────────────────────────────────────── */}
      <nav className="nav-mobile" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-nav)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>♟</span>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800, fontSize: '20px',
            background: 'linear-gradient(135deg, #f1f5f9, var(--emerald))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Stonkfish
          </span>
        </div>

        <div className="nav-actions-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/leaderboard" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            textDecoration: 'none', fontSize: '13px', fontWeight: 500,
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            🏆 Leaderboard
          </Link>
          <Link to="/profile" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            textDecoration: 'none', fontSize: '13px', fontWeight: 500,
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--emerald)'; e.currentTarget.style.color = 'var(--emerald)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Profile
          </Link>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--emerald)'; e.currentTarget.style.color = 'var(--emerald)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            title="Settings"
          >
            ⚙
          </button>
          <ThemeToggle />
          <button
            onClick={logout}
            className="btn btn-ghost"
            style={{ padding: '7px 14px', fontSize: '13px' }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero Section */}
        <div style={{ marginBottom: '40px', animation: 'fadeInUp 0.4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--emerald), #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', color: '#fff',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
              lineHeight: 1
            }}>
              {PIECE_SYMBOLS[user?.avatar_color || 'w'][user?.avatar_piece || 'K']}
            </div>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '28px', fontWeight: 800,
                margin: 0, letterSpacing: '-0.5px',
              }}>
                Welcome back, {user?.username}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>
                Ready for your next match?
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex-col-mobile" style={{
          display: 'flex', gap: '12px', flexWrap: 'wrap',
          marginBottom: '32px',
        }}>
          {loadingStats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass" style={{ flex: 1, minWidth: '130px', height: '110px', opacity: 0.4 }} />
            ))
          ) : (
            <>
              <StatCard value={`${winRate}%`} label="Win Rate"      color="var(--emerald)" icon="🏆" delay={0} />
              <StatCard value={stats.wins}    label="Wins"          color="var(--emerald)" icon="✓"  delay={0.05} />
              <StatCard value={losses < 0 ? 0 : losses} label="Losses" color="var(--red)"    icon="✗"  delay={0.1} />
              <StatCard value={stats.games_played} label="Games Played" color="var(--blue)"  icon="♟"  delay={0.15} />
            </>
          )}
        </div>

        {/* Play CTA + Leaderboard Banner */}
        <div className="grid-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '36px' }}>

          {/* Play Now Card */}
          <div
            className="glass"
            style={{
              padding: '28px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)',
              border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              gap: '16px',
              animation: 'fadeInUp 0.4s ease 0.2s both',
            }}
          >
            <div>
              <p style={{ fontSize: '28px', marginBottom: '8px' }}>♜</p>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
                Play a Game
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Challenge a friend, or test your skills against our ML or Greedy engine at any depth.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setIsPlayModalOpen(true)}
              style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            >
              Play Now →
            </button>
          </div>

          {/* Leaderboard Card */}
          <Link
            to="/leaderboard"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="glass"
              style={{
                padding: '28px',
                background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.02) 100%)',
                border: '1px solid rgba(251,191,36,0.2)',
                height: '100%',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                gap: '16px',
                cursor: 'pointer',
                animation: 'fadeInUp 0.4s ease 0.25s both',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.2)'; }}
            >
              <div>
                <p style={{ fontSize: '28px', marginBottom: '8px' }}>🏆</p>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                  Leaderboard
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  See how you rank against all players. Top 50 competitors sorted by win rate.
                </p>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                color: 'var(--gold)', fontSize: '14px', fontWeight: 600,
              }}>
                View Rankings →
              </div>
            </div>
          </Link>
        </div>

        {/* Tabs for Games */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0.3s both' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button
                onClick={() => setActiveTab('continue')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: activeTab === 'continue' ? 800 : 600,
                  color: activeTab === 'continue' ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'continue' ? '2px solid var(--emerald)' : 'none',
                  paddingBottom: '8px', marginBottom: '-9px',
                  transition: 'color 0.2s'
                }}
              >
                Continue Game
              </button>
              <button
                onClick={() => setActiveTab('previous')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: activeTab === 'previous' ? 800 : 600,
                  color: activeTab === 'previous' ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'previous' ? '2px solid var(--emerald)' : 'none',
                  paddingBottom: '8px', marginBottom: '-9px',
                  transition: 'color 0.2s'
                }}
              >
                Previous Games
              </button>
            </div>
            
            {gameLog.length > 0 && (
              <Link
                to="/profile"
                style={{ color: 'var(--emerald)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}
              >
                View Full History →
              </Link>
            )}
          </div>

          {loadingStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass" style={{ height: '56px', opacity: 0.3 }} />
              ))}
            </div>
          ) : displayedGames.length === 0 ? (
            <div className="glass" style={{
              padding: '48px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
            }}>
              <span style={{ fontSize: '40px' }}>♟</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
                {activeTab === 'continue' ? 'No games to resume' : 'No previous games played yet'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                {activeTab === 'continue' ? 'Start a new game to play!' : 'Finish a game to see your history here.'}
              </p>
              {activeTab === 'continue' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsPlayModalOpen(true)}
                  style={{ marginTop: '8px' }}
                >
                  Play New Game
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Header */}
              <div className="game-list-header" style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 1fr 80px 80px 80px',
                gap: '12px',
                padding: '8px 16px',
                fontSize: '11px', fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                <div>Res</div>
                <div>Opponent</div>
                <div>Date</div>
                <div style={{ textAlign: 'center' }}>Moves</div>
                <div style={{ textAlign: 'center' }}>Type</div>
                <div style={{ textAlign: 'center' }}>Action</div>
              </div>

              {displayedGames.map((game, idx) => (
                <div
                  key={game._id}
                  className="glass game-row-mobile"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 1fr 80px 80px 80px',
                    gap: '12px',
                    padding: '12px 16px',
                    alignItems: 'center',
                    animation: `fadeInUp 0.3s ease ${idx * 0.04}s both`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  {activeTab === 'continue' ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/play/${game._id}`)}
                      title="Resume Game"
                      style={{ padding: '6px', fontSize: '14px', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '28px', height: '28px' }}
                    >
                      ▶
                    </button>
                  ) : (
                    <ResultBadge result={game.result} />
                  )}
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {game.opponent}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDate(game.created_at)}
                  </div>
                  <div style={{
                    fontSize: '13px', fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)', textAlign: 'center',
                  }}>
                    {game.move_count}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700,
                      padding: '3px 8px', borderRadius: '99px',
                      background: game.game_type === 'pvp' ? 'var(--blue-dim)' : 'var(--emerald-dim)',
                      color: game.game_type === 'pvp' ? 'var(--blue)' : 'var(--emerald)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {game.game_type === 'pvp' ? 'PvP' : 'Bot'}
                    </span>
                  </div>
                  {activeTab !== 'continue' && (
                    <div style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => navigate(`/analyze/${game._id}`)}
                        style={{
                          padding: '4px 10px', borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-secondary)', fontSize: '11px',
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Analyze
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Play Modal ─────────────────────────────────────────────────────── */}
      <PlayModal
        isOpen={isPlayModalOpen}
        onClose={() => setIsPlayModalOpen(false)}
      />

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* ── Challenge Toast ────────────────────────────────────────────────── */}
      {pendingChallenge && (
        <ChallengeToast
          challenge={pendingChallenge}
          onAccept={handleAcceptChallenge}
          onDecline={handleDeclineChallenge}
        />
      )}
    </div>
  );
}
