import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import api from '../../services/api.js';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/admin/login', {
        username,
        password,
      });
      const { access_token, refresh_token, user } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail : detail?.message || err.message || 'Login failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-wrapper">
      <div className="admin-auth-left">
        <div className="admin-auth-left-content">
          <div className="admin-auth-logo">
            <span className="admin-auth-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            FreeLedger
          </div>
          <div className="admin-left-panel-content active">
            <h2>Admin Portal</h2>
            <p>Securely access the FreeLedger administration panel to manage users, jobs, contracts, and disputes.</p>
            <div className="admin-auth-feature-list">
              <div className="admin-auth-feature">
                <span className="admin-dot">✓</span> User account management
              </div>
              <div className="admin-auth-feature">
                <span className="admin-dot">✓</span> Job and proposal oversight
              </div>
              <div className="admin-auth-feature">
                <span className="admin-dot">✓</span> Contract lifecycle control
              </div>
              <div className="admin-auth-feature">
                <span className="admin-dot">✓</span> Dispute resolution panel
              </div>
              <div className="admin-auth-feature">
                <span className="admin-dot">✓</span> Audit log viewer
              </div>
            </div>
          </div>
        </div>
        <div className="admin-auth-left-bottom">
          <p>Protected by blockchain cryptography — no central server can be breached.</p>
        </div>
      </div>

      <div className="admin-auth-right">
        <div className="admin-auth-form-wrap">
          <h2 className="admin-auth-form-title">Admin Sign In</h2>
          <p className="admin-auth-form-subtitle">Enter your credentials to access the admin panel.</p>

          {error && (
            <div className="admin-error-banner" style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 700 }}>✕</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="admin-form-group">
              <label className="admin-form-label">Username</label>
              <input
                className="admin-form-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Password</label>
              <input
                className="admin-form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 4 }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
