import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

// ─── Sub-component: Color Picker ────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  const options = [
    { value: 'w', label: '♙ White', title: 'Play as White' },
    { value: 'b', label: '♟ Black', title: 'Play as Black' },
    { value: 'random', label: '⚄ Random', title: 'Randomize color' },
  ];
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: '8px',
            border: `1px solid ${value === o.value ? 'var(--emerald)' : 'var(--border)'}`,
            background: value === o.value ? 'var(--emerald-dim)' : 'var(--bg-input)',
            color: value === o.value ? 'var(--emerald)' : 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: value === o.value ? 700 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Sub-component: Depth Slider ────────────────────────────────────────────
function DepthSlider({ value, onChange, min, max, suggested, accentColor }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Search Depth
        </label>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '20px',
          fontWeight: 700,
          color: accentColor,
          minWidth: '32px',
          textAlign: 'right',
        }}>
          {value}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          appearance: 'none',
          height: '6px',
          borderRadius: '99px',
          background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 100%)`,
          cursor: 'pointer',
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(d => (
          <div key={d} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
          }}>
            <div style={{
              width: '4px', height: '4px', borderRadius: '50%',
              background: d <= value ? accentColor : 'rgba(255,255,255,0.15)',
              transition: 'background 0.15s',
            }} />
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: d <= value ? accentColor : 'var(--text-muted)',
              fontWeight: d === value ? 700 : 400,
            }}>
              {d}
            </span>
          </div>
        ))}
      </div>
      {value <= suggested && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
          ✓ Recommended range (fast response)
        </p>
      )}
      {value > suggested && (
        <p style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '8px', textAlign: 'center' }}>
          ⚠ Deep search — may take several seconds
        </p>
      )}
    </div>
  );
}

// ─── Main PlayModal ──────────────────────────────────────────────────────────
export default function PlayModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ml');
  const [mlDepth, setMlDepth] = useState(2);
  const [greedyDepth, setGreedyDepth] = useState(2);
  const [mlColor, setMlColor] = useState('random');
  const [greedyColor, setGreedyColor] = useState('random');
  const [challengeUser, setChallengeUser] = useState('');
  const [challengeColor, setChallengeColor] = useState('random');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [challengeSent, setChallengeSent] = useState(false);
  const overlayRef = useRef();

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setError('');
      setChallengeSent(false);
      setChallengeUser('');
    }
  }, [isOpen]);

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const resolveColor = (colorChoice) => {
    if (colorChoice === 'random') return Math.random() > 0.5 ? 'w' : 'b';
    return colorChoice;
  };

  const handleStartBotGame = async (engineMode, depth, colorChoice) => {
    setIsLoading(true);
    setError('');
    try {
      const playerColor = resolveColor(colorChoice);
      const response = await apiClient.post('/games', {
        game_type: 'bot',
        engine_mode: engineMode,
        engine_depth: depth,
        player_color: playerColor,
      });
      const gameId = response.data.game_id || response.data._id;
      onClose();
      navigate(`/play/${gameId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChallenge = async () => {
    if (!challengeUser.trim()) { setError('Please enter a username.'); return; }
    setIsLoading(true);
    setError('');
    try {
      await apiClient.post('/challenges', {
        receiver_username: challengeUser.trim(),
        sender_color: challengeColor,
      });
      setChallengeSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send challenge. User may not exist.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'challenge', icon: '⚔', label: 'Challenge', sublabel: 'vs Player' },
    { id: 'ml',        icon: '🤖', label: 'ML Engine', sublabel: 'Neural Net' },
    { id: 'greedy',    icon: '⚡', label: 'Greedy',    sublabel: 'Classic AI' },
  ];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className="glass"
        style={{
          width: '100%', maxWidth: '480px',
          padding: 0, overflow: 'hidden',
          animation: 'scaleIn 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.4px', margin: 0 }}>
              New Game
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Choose your opponent and settings
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '2px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px', padding: '20px 24px 0',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(''); setChallengeSent(false); }}
              style={{
                flex: 1, padding: '10px 6px',
                borderRadius: '10px',
                border: `1px solid ${activeTab === tab.id ? 'var(--emerald)' : 'var(--border)'}`,
                background: activeTab === tab.id ? 'var(--emerald-dim)' : 'transparent',
                color: activeTab === tab.id ? 'var(--emerald)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              }}
            >
              <span style={{ fontSize: '18px' }}>{tab.icon}</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>{tab.label}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{tab.sublabel}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Challenge Tab ── */}
          {activeTab === 'challenge' && !challengeSent && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Opponent's Username
                </label>
                <input
                  value={challengeUser}
                  onChange={e => setChallengeUser(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChallenge()}
                  placeholder="Enter username to challenge…"
                  className="sf-input"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Your Color Preference
                </label>
                <ColorPicker value={challengeColor} onChange={setChallengeColor} />
              </div>
              <div style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'var(--blue)',
              }}>
                💡 The challenge will be sent instantly via real-time notification. They have 24 hours to accept.
              </div>
            </div>
          )}

          {activeTab === 'challenge' && challengeSent && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              padding: '20px 0', animation: 'fadeInUp 0.3s ease',
            }}>
              <div style={{ fontSize: '48px' }}>⚔️</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700 }}>
                Challenge Sent!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
                Your challenge to <strong style={{ color: 'var(--text-primary)' }}>{challengeUser}</strong> has been sent. You'll be notified when they accept.
              </p>
              <button className="btn btn-ghost" onClick={onClose} style={{ marginTop: '8px' }}>
                Back to Dashboard
              </button>
            </div>
          )}

          {/* ── ML Engine Tab ── */}
          {activeTab === 'ml' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: '10px',
                padding: '12px 14px',
              }}>
                <div style={{ fontSize: '28px' }}>🧠</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>ML StonkFish</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Neural network evaluator · Learns from real games
                  </div>
                </div>
              </div>
              <DepthSlider
                value={mlDepth}
                onChange={setMlDepth}
                min={1}
                max={6}
                suggested={3}
                accentColor="var(--emerald)"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Your Color
                </label>
                <ColorPicker value={mlColor} onChange={setMlColor} />
              </div>
            </div>
          )}

          {/* ── Greedy Engine Tab ── */}
          {activeTab === 'greedy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: '10px',
                padding: '12px 14px',
              }}>
                <div style={{ fontSize: '28px' }}>⚡</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Greedy StonkFish</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Classic heuristic search · Original StonkFish algorithm
                  </div>
                </div>
              </div>
              <DepthSlider
                value={greedyDepth}
                onChange={setGreedyDepth}
                min={1}
                max={8}
                suggested={3}
                accentColor="var(--amber)"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Your Color
                </label>
                <ColorPicker value={greedyColor} onChange={setGreedyColor} />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div style={{
              background: 'var(--red-dim)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              color: 'var(--red)',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          {!(activeTab === 'challenge' && challengeSent) && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-ghost"
                onClick={onClose}
                style={{ flex: 1 }}
                disabled={isLoading}
              >
                Cancel
              </button>
              {activeTab === 'challenge' && (
                <button
                  className="btn btn-primary"
                  onClick={handleSendChallenge}
                  style={{ flex: 2 }}
                  disabled={isLoading || !challengeUser.trim()}
                >
                  {isLoading ? 'Sending…' : 'Send Challenge ⚔'}
                </button>
              )}
              {activeTab === 'ml' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleStartBotGame('ml', mlDepth, mlColor)}
                  style={{ flex: 2 }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Starting…' : `Play vs ML (Depth ${mlDepth}) →`}
                </button>
              )}
              {activeTab === 'greedy' && (
                <button
                  onClick={() => handleStartBotGame('greedy', greedyDepth, greedyColor)}
                  style={{
                    flex: 2, padding: '10px 20px',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px', fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                    background: 'var(--amber)',
                    color: '#000',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
                    transition: 'all 0.2s',
                  }}
                  disabled={isLoading}
                  onMouseEnter={e => !isLoading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  {isLoading ? 'Starting…' : `Play vs Greedy (Depth ${greedyDepth}) →`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
