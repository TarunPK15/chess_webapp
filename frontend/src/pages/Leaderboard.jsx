import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import apiClient from '../services/apiClient';

function RankBadge({ rank }) {
  if (rank === 1) return <span style={{ fontSize: '20px' }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: '20px' }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: '20px' }}>🥉</span>;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      color: 'var(--text-muted)',
      fontWeight: 600,
      minWidth: '24px',
      display: 'inline-block',
      textAlign: 'center',
    }}>
      {rank}
    </span>
  );
}

function WinRateBar({ rate }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px' }}>
      <div style={{
        flex: 1, height: '6px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '99px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${rate}%`,
          background: rate >= 60
            ? 'linear-gradient(90deg, var(--emerald), #34d399)'
            : rate >= 40
            ? 'linear-gradient(90deg, var(--amber), #fcd34d)'
            : 'linear-gradient(90deg, var(--red), #f87171)',
          borderRadius: '99px',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        fontWeight: 700,
        color: rate >= 60 ? 'var(--emerald)' : rate >= 40 ? 'var(--amber)' : 'var(--red)',
        minWidth: '38px',
      }}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

export default function Leaderboard() {
  const { user } = useAuthStore();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await apiClient.get('/leaderboard');
        const data = res.data || [];
        setPlayers(data);

        const rank = data.findIndex(p => p.username === user?.username);
        if (rank !== -1) setMyRank(rank + 1);
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [user?.username]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 80% 0%, rgba(251,191,36,0.04) 0%, transparent 50%), var(--bg-base)',
    }}>
      {/* ── Nav ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(15,20,32,0.8)',
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/dashboard" style={{
            padding: '7px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: 'var(--text-secondary)', textDecoration: 'none',
            fontSize: '13px', fontWeight: 500,
            transition: 'all 0.15s',
          }}>
            ← Dashboard
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '36px', animation: 'fadeInUp 0.4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            <span style={{ fontSize: '36px' }}>🏆</span>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '32px', fontWeight: 900,
                margin: 0, letterSpacing: '-1px',
              }}>
                Leaderboard
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                Top 50 players ranked by win rate
              </p>
            </div>
          </div>

          {/* Your Rank Banner */}
          {myRank && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 18px',
              marginTop: '20px',
              animation: 'fadeInUp 0.4s ease 0.1s both',
            }}>
              <span style={{ fontSize: '22px' }}>⭐</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                You are ranked <strong style={{ color: 'var(--emerald)', fontSize: '18px', fontFamily: 'var(--font-heading)' }}>#{myRank}</strong> out of {players.length} players
              </span>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ 
          overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px',
          width: '100%', maxWidth: '100vw'
        }}>
          <div className="glass" style={{ minWidth: '700px', overflow: 'hidden', animation: 'fadeInUp 0.4s ease 0.15s both' }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '56px 1fr 80px 80px 80px 160px',
            gap: '12px',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            fontSize: '11px', fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}>
            <div style={{ textAlign: 'center' }}>Rank</div>
            <div>Player</div>
            <div style={{ textAlign: 'right' }}>Games</div>
            <div style={{ textAlign: 'right' }}>Wins</div>
            <div style={{ textAlign: 'right' }}>Avg Moves</div>
            <div style={{ textAlign: 'center' }}>Win Rate</div>
          </div>

          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{
                height: '58px',
                borderBottom: '1px solid var(--border)',
                background: `rgba(255,255,255,${0.005 * (i % 2)})`,
                animation: 'fadeIn 0.3s ease',
              }} />
            ))
          ) : players.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No players found. Be the first to play!
            </div>
          ) : (
            players.map((player, idx) => {
              const isMe = player.username === user?.username;
              const winRate = player.win_rate || 0;

              return (
                <div
                  key={player._id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '56px 1fr 80px 80px 80px 160px',
                    gap: '12px',
                    padding: '14px 20px',
                    alignItems: 'center',
                    borderBottom: idx < players.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isMe
                      ? 'linear-gradient(90deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.03) 100%)'
                      : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    transition: 'background 0.15s',
                    animation: `fadeInUp 0.3s ease ${idx * 0.03}s both`,
                    position: 'relative',
                  }}
                  onMouseEnter={e => !isMe && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => !isMe && (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                >
                  {/* Current user left accent */}
                  {isMe && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: '3px', background: 'var(--emerald)',
                      borderRadius: '0 2px 2px 0',
                    }} />
                  )}

                  <div style={{ textAlign: 'center' }}>
                    <RankBadge rank={idx + 1} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '8px',
                      background: isMe
                        ? 'linear-gradient(135deg, var(--emerald), #059669)'
                        : `hsl(${(player.username.charCodeAt(0) * 37) % 360}, 50%, 45%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 800, color: '#fff',
                      fontFamily: 'var(--font-heading)',
                      flexShrink: 0,
                    }}>
                      {player.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{
                        fontWeight: isMe ? 700 : 500,
                        fontSize: '14px',
                        color: isMe ? 'var(--emerald)' : 'var(--text-primary)',
                      }}>
                        {player.username}
                        {isMe && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700,
                            background: 'var(--emerald-dim)',
                            color: 'var(--emerald)',
                            border: '1px solid var(--emerald-glow)',
                            borderRadius: '4px', padding: '1px 5px',
                            marginLeft: '8px', verticalAlign: 'middle',
                          }}>
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)',
                  }}>
                    {player.games_played}
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--emerald)',
                    fontWeight: 600,
                  }}>
                    {player.wins}
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-muted)',
                  }}>
                    {Math.round(player.avg_moves) || '—'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <WinRateBar rate={winRate} />
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        <p style={{
          textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '16px',
        }}>
          Rankings update after each completed game
        </p>
      </main>
    </div>
  );
}
