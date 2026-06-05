import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import apiClient from '../services/apiClient';
import ThemeToggle from '../components/ThemeToggle';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ResultBadge({ result }) {
  const map = {
    win:       { label: 'W', cls: 'badge-win' },
    loss:      { label: 'L', cls: 'badge-loss' },
    draw:      { label: 'D', cls: 'badge-draw' },
    abandoned: { label: '—', cls: 'badge-abandoned' },
  };
  const cfg = map[result] || map.abandoned;
  return (
    <span
      className={cfg.cls}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '30px', height: '30px', borderRadius: '7px',
        fontSize: '12px', fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

function StatCard({ value, label, color, icon }) {
  return (
    <div className="glass" style={{
      flex: 1, minWidth: '120px', padding: '20px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
      <div style={{
        fontSize: '28px', fontWeight: 800,
        fontFamily: 'var(--font-heading)',
        color, lineHeight: 1, letterSpacing: '-0.5px',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px',
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, updateUser, logout } = useAuthStore();
  const [games, setGames] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const [editMode, setEditMode] = useState(false);
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editAvatarPiece, setEditAvatarPiece] = useState(user?.avatar_piece || 'K');
  const [editAvatarColor, setEditAvatarColor] = useState(user?.avatar_color || 'w');
  const [savingProfile, setSavingProfile] = useState(false);

  const PIECE_SYMBOLS = {
    w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
    b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [lbRes, gamesRes] = await Promise.all([
          apiClient.get('/leaderboard'),
          apiClient.get('/games/my-games?limit=50'),
        ]);

        const me = lbRes.data.find(u => u.username === user?.username);
        setStats(me || null);
        setGames(gamesRes.data || []);
      } catch (err) {
        console.error('Profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user?.username]);

  const totalGames = stats?.games_played || 0;
  const wins = stats?.wins || 0;
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';

  const pagedGames = games.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(games.length / PAGE_SIZE);

  // Engine mode breakdown
  const mlGames = games.filter(g => g.engine_mode && g.engine_mode.startsWith('ml')).length;
  const greedyGames = games.filter(g => g.engine_mode && g.engine_mode.startsWith('greedy')).length;
  const pvpGames = games.filter(g => g.game_type === 'pvp').length;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await apiClient.patch('/auth/profile', {
        email: editEmail,
        avatar_piece: editAvatarPiece,
        avatar_color: editAvatarColor
      });
      updateUser(res.data.user);
      setEditMode(false);
    } catch (err) {
      console.error('Failed to update profile', err);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
    }}>
      {/* ── Nav ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-nav)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link to="/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none',
        }}>
          <span style={{ fontSize: '22px' }}>♟</span>
          <span style={{
            fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '18px',
            background: 'linear-gradient(135deg, #f1f5f9, var(--emerald))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Stonkfish
          </span>
        </Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link to="/leaderboard" style={{
            padding: '7px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: 'var(--text-secondary)', textDecoration: 'none',
            fontSize: '13px', fontWeight: 500,
          }}>
            🏆 Leaderboard
          </Link>
          <Link to="/dashboard" style={{
            padding: '7px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: 'var(--text-secondary)', textDecoration: 'none',
            fontSize: '13px', fontWeight: 500,
          }}>
            ← Dashboard
          </Link>
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

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Profile Hero */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '20px',
          marginBottom: '36px',
          animation: 'fadeInUp 0.4s ease',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px',
            background: 'linear-gradient(135deg, var(--emerald), #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '40px', color: '#fff',
            boxShadow: '0 6px 24px rgba(16,185,129,0.3)',
            flexShrink: 0,
            lineHeight: 1
          }}>
            {PIECE_SYMBOLS[user?.avatar_color || 'w'][user?.avatar_piece || 'K']}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '30px', fontWeight: 900,
              margin: 0, letterSpacing: '-0.8px',
            }}>
              {user?.username}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {user?.email ? user.email + ' • ' : ''}
              Member since {loading || !stats ? '...' : formatDate(stats.created_at || Date.now()).split(',')[0]}
            </p>
          </div>
          <div>
            <button
              onClick={() => setEditMode(!editMode)}
              className="btn btn-ghost"
              style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid var(--border)' }}
            >
              {editMode ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Profile Edit Panel */}
        {editMode && (
          <div className="glass" style={{
            padding: '24px', marginBottom: '32px',
            animation: 'fadeInUp 0.3s ease',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '18px' }}>Edit Profile</h3>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Email</label>
              <input 
                type="email" 
                value={editEmail} 
                onChange={e => setEditEmail(e.target.value)}
                style={{
                  width: '100%', maxWidth: '300px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', padding: '10px 14px', borderRadius: '8px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Avatar Color</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['w', 'b'].map(c => (
                  <button
                    key={c}
                    onClick={() => setEditAvatarColor(c)}
                    style={{
                      padding: '8px 16px', borderRadius: '8px',
                      background: editAvatarColor === c ? 'var(--emerald)' : 'var(--bg-input)',
                      color: editAvatarColor === c ? '#000' : 'var(--text-primary)',
                      border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    {c === 'w' ? 'White' : 'Black'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Avatar Piece</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {['K', 'Q', 'R', 'B', 'N', 'P'].map(p => (
                  <button
                    key={p}
                    onClick={() => setEditAvatarPiece(p)}
                    style={{
                      width: '44px', height: '44px', borderRadius: '8px',
                      background: editAvatarPiece === p ? 'var(--emerald)' : 'var(--bg-input)',
                      color: editAvatarPiece === p ? '#000' : 'var(--text-primary)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {PIECE_SYMBOLS[editAvatarColor][p]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                style={{
                  background: 'var(--emerald)', color: '#000', border: 'none',
                  padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div style={{
          display: 'flex', gap: '12px', flexWrap: 'wrap',
          marginBottom: '32px',
          animation: 'fadeInUp 0.4s ease 0.1s both',
        }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass" style={{ flex: 1, minWidth: '120px', height: '100px', opacity: 0.4 }} />
            ))
          ) : (
            <>
              <StatCard value={`${winRate}%`} label="Win Rate"    color="var(--emerald)" icon="🏆" />
              <StatCard value={wins}          label="Wins"         color="var(--emerald)" icon="✓" />
              <StatCard value={losses < 0 ? 0 : losses} label="Losses" color="var(--red)"    icon="✗" />
              <StatCard value={totalGames}    label="Total Games"  color="var(--blue)"    icon="♟" />
            </>
          )}
        </div>

        {/* Game Type Breakdown */}
        {!loading && games.length > 0 && (
          <div className="glass" style={{
            padding: '20px 24px',
            marginBottom: '28px',
            animation: 'fadeInUp 0.4s ease 0.15s both',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700,
              margin: '0 0 16px', color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Game Breakdown
            </h3>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {[
                { label: 'vs ML Engine', count: mlGames, color: 'var(--emerald)', icon: '🤖' },
                { label: 'vs Greedy Engine', count: greedyGames, color: 'var(--amber)', icon: '⚡' },
                { label: 'vs Players', count: pvpGames, color: 'var(--blue)', icon: '⚔' },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  flex: 1, minWidth: '160px',
                  background: 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}>
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-heading)', color: item.color }}>
                      {item.count}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {item.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game History Table */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0.2s both' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '14px',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, margin: 0,
            }}>
              Game History
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {games.length} games total
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass" style={{ height: '54px', opacity: 0.3 }} />
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="glass" style={{
              padding: '48px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '36px' }}>♟</span>
              <p style={{ color: 'var(--text-secondary)' }}>No games played yet</p>
              <Link to="/dashboard" style={{
                color: 'var(--emerald)', textDecoration: 'none',
                fontSize: '14px', fontWeight: 600,
              }}>
                Start Playing →
              </Link>
            </div>
          ) : (
            <>
              <div className="glass" style={{ overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr 90px 80px 80px 120px',
                  gap: '10px',
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '11px', fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  <div>Res</div>
                  <div>Opponent / Mode</div>
                  <div style={{ textAlign: 'right' }}>Date</div>
                  <div style={{ textAlign: 'right' }}>Moves</div>
                  <div style={{ textAlign: 'right' }}>Color</div>
                  <div style={{ textAlign: 'center' }}>Type</div>
                </div>

                {pagedGames.map((game, idx) => (
                  <div
                    key={game._id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px 1fr 90px 80px 80px 120px',
                      gap: '10px',
                      padding: '12px 18px',
                      alignItems: 'center',
                      borderBottom: idx < pagedGames.length - 1 ? '1px solid var(--border)' : 'none',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      transition: 'background 0.15s',
                      animation: `fadeInUp 0.3s ease ${idx * 0.03}s both`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                  >
                    <ResultBadge result={game.result} />

                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        fontSize: '13px', fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {game.opponent}
                      </div>
                    </div>

                    <div style={{
                      textAlign: 'right',
                      fontSize: '11px', color: 'var(--text-muted)',
                    }}>
                      {formatDate(game.created_at).split(',')[0]}
                    </div>

                    <div style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)', fontSize: '13px',
                      color: 'var(--text-secondary)',
                    }}>
                      {game.move_count}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '12px',
                        color: game.player_color === 'w' ? '#f1f5f9' : 'var(--text-muted)',
                        fontWeight: 600,
                      }}>
                        {game.player_color === 'w' ? '♙ White' : '♟ Black'}
                      </span>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        padding: '3px 8px', borderRadius: '99px',
                        background: game.game_type === 'pvp'
                          ? 'var(--blue-dim)'
                          : game.engine_mode?.startsWith('ml')
                          ? 'var(--emerald-dim)'
                          : 'var(--amber-dim)',
                        color: game.game_type === 'pvp'
                          ? 'var(--blue)'
                          : game.engine_mode?.startsWith('ml')
                          ? 'var(--emerald)'
                          : 'var(--amber)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {game.game_type === 'pvp' ? 'PvP' : game.engine_mode?.startsWith('ml') ? 'ML' : 'Greedy'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  gap: '10px', marginTop: '16px',
                }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    style={{ padding: '7px 14px', fontSize: '13px' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Page {page + 1} / {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    style={{ padding: '7px 14px', fontSize: '13px' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
