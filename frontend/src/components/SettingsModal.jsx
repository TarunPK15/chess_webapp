import { useSettings, BOARD_THEMES, PIECE_SETS } from '../context/SettingsContext';

export default function SettingsModal({ isOpen, onClose }) {
  const { boardTheme, setBoardTheme, pieceSet, setPieceSet } = useSettings();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        width: '400px',
        maxWidth: '90%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        animation: 'slideDown 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>⚙ Settings</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '20px', cursor: 'pointer'
          }}>×</button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
            Board Theme
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.keys(BOARD_THEMES).map(key => (
              <button
                key={key}
                onClick={() => setBoardTheme(key)}
                style={{
                  flex: '1 1 45%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: `2px solid ${boardTheme === key ? 'var(--emerald)' : 'var(--border)'}`,
                  background: 'var(--bg-surface)',
                  color: boardTheme === key ? 'var(--emerald)' : 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {BOARD_THEMES[key].name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
            Piece Set
          </label>
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            {Object.keys(PIECE_SETS).map(key => (
              <button
                key={key}
                onClick={() => setPieceSet(key)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `2px solid ${pieceSet === key ? 'var(--emerald)' : 'var(--border)'}`,
                  background: 'var(--bg-surface)',
                  color: pieceSet === key ? 'var(--emerald)' : 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex', justifyContent: 'space-between'
                }}
              >
                <span>{PIECE_SETS[key].name}</span>
                {pieceSet === key && <span>✓</span>}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
          Done
        </button>
      </div>
    </div>
  );
}
