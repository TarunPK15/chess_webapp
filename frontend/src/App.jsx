import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Play from './pages/Play';
import Analyze from './pages/Analyze';
import { SettingsProvider } from './context/SettingsContext';

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public Auth Routes ── */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ── Protected Routes (require valid JWT token) ── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/profile"         element={<Profile />} />
            <Route path="/leaderboard"     element={<Leaderboard />} />

            {/* Game Page — handles both new and resumed sessions */}
            <Route path="/play"            element={<Play />} />
            <Route path="/play/:game_id"   element={<Play />} />
            
            <Route path="/analyze/:game_id" element={<Analyze />} />
          </Route>

          {/* ── Fallback redirect ── */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}