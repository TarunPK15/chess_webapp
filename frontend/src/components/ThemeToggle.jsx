import { useTheme } from '../ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button 
      onClick={toggleTheme}
      className="btn btn-ghost"
      style={{
        padding: '7px 14px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', background: 'var(--bg-card)',
        color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: '6px'
      }}
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
