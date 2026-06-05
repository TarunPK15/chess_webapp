import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import apiClient from '../services/apiClient';

const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const response = await apiClient.post('/auth/login', data);
      login(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (error) {
      setServerError(error.response?.data?.message || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.06) 0%, var(--bg-base) 60%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px', height: '56px',
            background: 'var(--emerald-dim)',
            border: '1px solid var(--emerald-glow)',
            borderRadius: '14px',
            fontSize: '28px',
            marginBottom: '16px',
          }}>♟</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Stonkfish
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="glass" style={{ padding: '32px', animation: 'scaleIn 0.25s ease forwards' }}>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {serverError && (
              <div style={{
                background: 'var(--red-dim)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                color: 'var(--red)',
                fontSize: '13px',
              }}>
                {serverError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Username</label>
              <input
                {...register('username')}
                placeholder="your_username"
                className="sf-input"
                autoComplete="username"
                autoFocus
              />
              {errors.username && <span style={{ color: 'var(--red)', fontSize: '12px' }}>{errors.username.message}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="sf-input"
                autoComplete="current-password"
              />
              {errors.password && <span style={{ color: 'var(--red)', fontSize: '12px' }}>{errors.password.message}</span>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '4px' }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '20px' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--emerald)', textDecoration: 'none', fontWeight: 600 }}>
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}