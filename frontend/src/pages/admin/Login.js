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
      navigate('/admin/dashboard');
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
      <div className="admin-auth-card">
        <div className="admin-auth-logo">
          ⚡ FreeLedger <span className="admin-badge">Admin</span>
        </div>
        <h2 className="admin-auth-title">Admin Sign In</h2>
        <p className="admin-auth-subtitle">Enter your credentials to access the admin panel.</p>

        {error && <div className="error-message" style={{ marginBottom: 16, padding: 12, backgroundColor: '#ffeaea', border: '1px solid #ffcccc', borderRadius: 4, color: '#d32f2f' }}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 8 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
