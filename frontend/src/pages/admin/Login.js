import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import api from '../../services/api.js';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totpPending, setTotpPending] = useState(false);
  const [totpToken, setTotpToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [cooldown, setCooldown] = useState(() => {
    const until = parseInt(localStorage.getItem('totp_cooldown_until') || '0', 10);
    if (until > Date.now()) return Math.ceil((until - Date.now()) / 1000);
    return 0;
  });
  const cooldownRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      localStorage.removeItem('totp_cooldown_until');
      return;
    }
    localStorage.setItem('totp_cooldown_until', String(Date.now() + cooldown * 1000));
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          localStorage.removeItem('totp_cooldown_until');
          return 0;
        }
        localStorage.setItem('totp_cooldown_until', String(Date.now() + (prev - 1) * 1000));
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldown > 0]);

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
      const data = response.data;

      if (data.requires_totp) {
        setTotpToken(data.totp_token);
        setTotpPending(true);
        setError(null);
        setLoading(false);
        return;
      }

      const { access_token, refresh_token, user } = data;
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

  const handleTOTPValidate = async (e) => {
    e.preventDefault();
    if (!totpCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/totp/validate', {
        totp_token: totpToken,
        code: totpCode.trim(),
      });
      const { access_token, refresh_token, user } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      if (response.data.backup_login) {
        localStorage.setItem('backup_login', '1');
      }
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 429 && detail?.code === 'RATE_LIMITED') {
        const match = detail.message.match(/Wait (\d+) seconds/);
        const secs = match ? parseInt(match[1], 10) : 60;
        setCooldown(secs);
        setError(detail.message);
      } else {
        const errorMsg = typeof detail === 'string' ? detail : detail?.message || err.message || 'Verification failed';
        setError(errorMsg);
      }
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
            <div className="admin-auth-eyebrow">
              <span className="admin-auth-eyebrow-dot" />
              Secure admin access
            </div>
            <h2>
              Control the{' '}
              <span className="admin-auth-title-accent">decentralized economy</span>
            </h2>
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

          {totpPending ? (
            <form onSubmit={handleTOTPValidate}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Two-Factor Authentication</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {useBackupCode ? 'Enter one of your single-use backup codes' : 'Enter the code from your authenticator app'}
                </p>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">{useBackupCode ? 'Backup Code' : 'Verification Code'}</label>
                <input
                  className="admin-form-input"
                  type="text"
                  inputMode={useBackupCode ? 'text' : 'numeric'}
                  pattern={useBackupCode ? '[A-Za-z0-9-]*' : '[0-9]*'}
                  maxLength={useBackupCode ? 9 : 6}
                  placeholder={cooldown > 0 ? `Locked for ${cooldown}s` : useBackupCode ? 'XXXX-XXXX' : '000000'}
                  value={totpCode}
                  onChange={e => {
                    if (cooldown > 0) return;
                    if (useBackupCode) {
                      setTotpCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                    } else {
                      setTotpCode(e.target.value.replace(/[^0-9]/g, ''));
                    }
                  }}
                  disabled={cooldown > 0}
                  autoFocus={cooldown <= 0}
                  style={{
                    textAlign: 'center', fontSize: 20, letterSpacing: 5, fontWeight: 700,
                    opacity: cooldown > 0 ? 0.5 : 1,
                  }}
                />
                {cooldown > 0 ? (
                  <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 6 }}>
                    Too many attempts. Try again in {cooldown} second{cooldown !== 1 ? 's' : ''}.
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                    {useBackupCode ? 'Enter one of your single-use backup codes' : 'Enter the 6-digit code from your authenticator app'}
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 4 }} disabled={loading || cooldown > 0}>
                {cooldown > 0 ? `Locked (${cooldown}s)` : loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <a
                  onClick={() => { setUseBackupCode(!useBackupCode); setTotpCode(''); setError(null); }}
                  style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}
                >
                  {useBackupCode ? 'Use authenticator app instead' : "Don't have your authenticator?"}
                </a>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <a onClick={() => { setTotpPending(false); setTotpCode(''); setError(null); setUseBackupCode(false); }} style={{ fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>
                  ← Back to login
                </a>
              </div>
            </form>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
