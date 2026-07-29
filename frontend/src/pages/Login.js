/* eslint-disable jsx-a11y/anchor-is-valid */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import api from '../services/api.js';
import useAuth from '../hooks/useAuth';

const panels = {
  login: {
    eyebrow: 'Secure workspace access',
    title: 'Welcome back to the',
    titleAccent: 'decentralized economy',
    subtitle: 'Sign in with your wallet to access your projects, contracts, and earnings — no passwords needed.',
    features: [
      'Cryptographic wallet authentication',
      'Zero-knowledge identity verification',
      'Instant smart contract access',
      'Your keys, your data, your work',
    ],
    bottomText: 'Protected by blockchain cryptography — no central server can be breached.',
  },
  register: {
    eyebrow: 'Build without boundaries',
    title: 'Start your',
    titleAccent: 'decentralized journey today',
    subtitle: 'Join thousands of freelancers and clients building the future of work on the blockchain.',
    features: [
      'Free to join, no subscription fees',
      'Verifiable on-chain reputation',
      'Instant IPFS portfolio hosting',
      'Smart contract escrow protection',
    ],
    bottomText: 'Over 2,400 projects successfully completed on FreeLedger.',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// FastAPI validation errors (422) send `detail` as an array of
// { msg, loc, type } objects rather than a string or { message }.
function extractErrorMessage(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return detail?.message || err.message || fallback;
}

export default function Login() {
  const navigate = useNavigate();
  const { connectAndCheck } = useAuth();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const [loginRole, setLoginRole] = useState('');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletRoleModal, setWalletRoleModal] = useState(false);
  const [walletPending, setWalletPending] = useState(null);
  const [totpPending, setTotpPending] = useState(false);
  const [totpToken, setTotpToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpUser, setTotpUser] = useState(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [cooldown, setCooldown] = useState(() => {
    const until = parseInt(localStorage.getItem('totp_cooldown_until') || '0', 10);
    if (until > Date.now()) return Math.ceil((until - Date.now()) / 1000);
    return 0;
  });
  const cooldownRef = useRef(null);

  const panel = panels[tab];

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

  const validateLogin = () => {
    const errs = {};
    if (!email || !EMAIL_RE.test(email)) errs.email = 'Please enter a valid email.';
    if (!password) errs.password = 'Password is required.';
    if (!loginRole) errs.loginRole = 'Please select your role.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateRegister = () => {
    const errs = {};
    if (!firstName.trim()) errs.firstName = 'First name is required.';
    if (!email || !EMAIL_RE.test(email)) errs.email = 'Please enter a valid email.';
    if (!password || password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (!role) errs.role = 'Please select a role.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', {
        email: email.toLowerCase(),
        password,
        loginRole,
      });
      const data = response.data;

      if (data.requires_totp) {
        setTotpToken(data.totp_token);
        setTotpUser(data.user);
        setTotpPending(true);
        setError(null);
        setLoading(false);
        return;
      }

      const { access_token, refresh_token, user } = data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate(user.role === 'client' ? '/client/dashboard' : '/freelancer/dashboard');
    } catch (err) {
      setError(extractErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleTOTPValidate = async (e) => {
    e.preventDefault();
    if (!totpCode.trim() || totpCode.trim().length < 6) {
      setError('Please enter a 6-digit code');
      return;
    }
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
      navigate(user.role === 'client' ? '/client/dashboard' : '/freelancer/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 429 && detail?.code === 'RATE_LIMITED') {
        const match = detail.message.match(/Wait (\d+) seconds/);
        const secs = match ? parseInt(match[1], 10) : 60;
        setCooldown(secs);
        setError(detail.message);
      } else {
        setError(extractErrorMessage(err, 'Verification failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateRegister()) return;
    setLoading(true);
    setError(null);
    try {
      const username = [firstName, lastName].filter(Boolean).join(' ');
      const response = await api.post('/auth/register', {
        email: email.toLowerCase(),
        password,
        username,
        role,
      });
      const { access_token, refresh_token, user } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate(user.role === 'client' ? '/client/dashboard' : '/freelancer/dashboard');
    } catch (err) {
      setError(extractErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMask = async () => {
    setLoading(true);
    setError(null);

    if (tab === 'register') {
      // Sign Up flow: user filled email+password+role, linking wallet
      const registerErrors = {};
      if (!firstName.trim()) registerErrors.firstName = 'First name is required.';
      if (!email || !email.includes('@')) registerErrors.email = 'Please enter a valid email.';
      if (!password || password.length < 8) registerErrors.password = 'Password must be at least 8 characters.';
      if (!role) registerErrors.role = 'Please select a role.';
      setErrors(registerErrors);
      if (Object.keys(registerErrors).length > 0) {
        setLoading(false);
        return;
      }

      const username = [firstName, lastName].filter(Boolean).join(' ');
      const result = await connectAndCheck(role === 'Client' ? 'client' : 'freelancer', email, password, username);
      if (result.status === 'logged_in') {
        const r = result.user.role;
        navigate(r === 'client' ? '/client/dashboard' : '/freelancer/dashboard');
      } else if (result.status === 'error') {
        setError(result.message);
      }
    } else {
      // Login flow: pure wallet auth (no email needed)
      if (!loginRole) {
        setErrors({ loginRole: 'Please select your role.' });
        setLoading(false);
        return;
      }
      const result = await connectAndCheck(loginRole);

      if (result.status === 'needs_role') {
        // New wallet — ask the user for their role
        setWalletPending(result);
        setWalletRoleModal(true);
      } else if (result.status === 'logged_in') {
        const r = result.user.role;
        navigate(r === 'client' ? '/client/dashboard' : '/freelancer/dashboard');
      } else if (result.status === 'error') {
        setError(result.message);
      }
    }

    setLoading(false);
  };

  const handleWalletRoleConfirm = async (selectedRole) => {
    setWalletRoleModal(false);
    setLoading(true);
    const result = await connectAndCheck(selectedRole);
    if (result.status === 'logged_in') {
      const r = result.user.role;
      navigate(r === 'client' ? '/client/dashboard' : '/freelancer/dashboard');
    } else if (result.status === 'error') {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-left">
        <div className="auth-left-content">
          <Link to="/" className="nav-logo">
            <div className="nav-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            FreeLedger
          </Link>

          <div className="left-panel-content active">
            <div className="auth-eyebrow">
              <span className="auth-eyebrow-dot" />
              {panel.eyebrow}
            </div>
            <h2>
              {panel.title}{' '}
              <span className="auth-title-accent">{panel.titleAccent}</span>
            </h2>
            <p>{panel.subtitle}</p>
            <div className="auth-feature-list">
              {panel.features.map((f, i) => (
                <div key={i} className="auth-feature">
                  <div className="dot">✓</div> {f}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="auth-left-bottom">
          <p>{panel.bottomText}</p>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap">
          <Link to="/" className="back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to home
          </Link>

          {!totpPending && (
            <div className="tab-switcher">
              <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
              <button className={`tab-btn ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Create Account</button>
            </div>
          )}

          {/* Error Popup — visible on both tabs for wallet/auth errors */}
          {error && (
            <div className="error-popup">
              <div className="error-popup-content">
                <div className="error-popup-icon">!</div>
                <div className="error-popup-text">{error}</div>
                <button className="error-popup-close" onClick={() => setError(null)}>×</button>
              </div>
            </div>
          )}

          {totpPending ? (
            <div className="form-panel active">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Two-Factor Authentication</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <form onSubmit={handleTOTPValidate}>
                <div className="form-group">
                  <label className="form-label">
                    {useBackupCode ? 'Backup Code' : 'Verification Code'}
                  </label>
                  <input
                    className="form-input"
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
                      textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: 700,
                      opacity: cooldown > 0 ? 0.5 : 1,
                    }}
                  />
                  {cooldown > 0 ? (
                    <div className="form-hint" style={{ color: '#dc2626', fontWeight: 600 }}>
                      Too many attempts. Try again in {cooldown} second{cooldown !== 1 ? 's' : ''}.
                    </div>
                  ) : useBackupCode ? (
                    <div className="form-hint">Enter one of your single-use backup codes</div>
                  ) : (
                    <div className="form-hint">Enter the 6-digit code from your authenticator app</div>
                  )}
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading || cooldown > 0}>
                  {cooldown > 0 ? `Locked (${cooldown}s)` : loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <a
                  onClick={() => { setUseBackupCode(!useBackupCode); setTotpCode(''); setError(null); }}
                  style={{ fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}
                >
                  {useBackupCode ? 'Use authenticator app instead' : "Don't have your authenticator?"}
                </a>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <a onClick={() => { setTotpPending(false); setTotpCode(''); setError(null); setUseBackupCode(false); }} style={{ fontSize: 13, color: 'var(--text-3)', cursor: 'pointer' }}>
                  ← Back to login
                </a>
              </div>
            </div>
          ) : tab === 'login' ? (
            <div className="form-panel active">
              <p className="subtitle">Don't have an account? <a onClick={() => setTab('register')}>Create one →</a></p>
              <form onSubmit={handleLogin} autoComplete="on">
                <div className="form-group">
                  <label className="form-label" htmlFor="login-email">Email Address</label>
                  <input id="login-email" name="username" className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                  {errors.email && <div className="error-msg visible">{errors.email}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="login-password" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Password
                    <a href="#" style={{ fontWeight: 500, color: 'var(--blue)', fontSize: 12 }} onClick={(e) => e.preventDefault()}>Forgot?</a>
                  </label>
                  <input id="login-password" name="password" className="form-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  {errors.password && <div className="error-msg visible">{errors.password}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Signing in as</label>
                  <div className="role-selector">
                    <label className="role-option">
                      <input type="radio" name="login-role" value="client" checked={loginRole === 'client'} onChange={() => setLoginRole('client')} />
                      <div className="role-card">
                        <div className="role-icon">🏢</div>
                        <div className="role-name">Client</div>
                        <div className="role-desc">I hire talent</div>
                      </div>
                    </label>
                    <label className="role-option">
                      <input type="radio" name="login-role" value="freelancer" checked={loginRole === 'freelancer'} onChange={() => setLoginRole('freelancer')} />
                      <div className="role-card">
                        <div className="role-icon">💼</div>
                        <div className="role-name">Freelancer</div>
                        <div className="role-desc">I offer my skills</div>
                      </div>
                    </label>
                  </div>
                  {errors.loginRole && <div className="error-msg visible">{errors.loginRole}</div>}
                </div>
                <button type="submit" className="btn btn-primary btn-full" style={{ marginBottom: 14 }} disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
              <div className="form-divider"><span>or continue with</span></div>
              <button className="btn btn-outline btn-full" onClick={handleMetaMask} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 35 33" fill="none">
                  <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726"/>
                  <path d="M2.04187 1L15.0646 10.8048L12.7336 4.99098L2.04187 1Z" fill="#E27625"/>
                </svg>
                Connect with MetaMask
              </button>
              <p className="form-footer-note">By signing in you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</p>
            </div>
          ) : (
            <div className="form-panel active">
              <p className="subtitle">Already have an account? <a onClick={() => setTab('login')}>Sign in →</a></p>
              <form onSubmit={handleRegister} autoComplete="on">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="register-first-name">First Name</label>
                    <input id="register-first-name" name="given-name" className="form-input" type="text" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                    {errors.firstName && <div className="error-msg visible">{errors.firstName}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="register-last-name">Last Name</label>
                    <input id="register-last-name" name="family-name" className="form-input" type="text" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-email">Email Address</label>
                  <input id="register-email" name="username" className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                  {errors.email && <div className="error-msg visible">{errors.email}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-password">Password</label>
                  <input id="register-password" name="new-password" className="form-input" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  <div className="form-hint">Use at least 8 characters with letters and numbers.</div>
                  {errors.password && <div className="error-msg visible">{errors.password}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">I am joining as</label>
                  <div className="role-selector">
                    <label className="role-option">
                      <input type="radio" name="reg-role" value="Freelancer" checked={role === 'Freelancer'} onChange={() => setRole('Freelancer')} />
                      <div className="role-card">
                        <div className="role-icon">💼</div>
                        <div className="role-name">Freelancer</div>
                        <div className="role-desc">I offer my skills</div>
                      </div>
                    </label>
                    <label className="role-option">
                      <input type="radio" name="reg-role" value="Client" checked={role === 'Client'} onChange={() => setRole('Client')} />
                      <div className="role-card">
                        <div className="role-icon">🏢</div>
                        <div className="role-name">Client</div>
                        <div className="role-desc">I hire talent</div>
                      </div>
                    </label>
                  </div>
                  {errors.role && <div className="error-msg visible">{errors.role}</div>}
                </div>
                <button type="submit" className="btn btn-primary btn-full" style={{ marginBottom: 12 }} disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
              <div className="form-divider"><span>or</span></div>
              <button className="btn btn-outline btn-full" onClick={handleMetaMask} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 35 33" fill="none">
                  <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726"/>
                  <path d="M2.04187 1L15.0646 10.8048L12.7336 4.99098L2.04187 1Z" fill="#E27625"/>
                </svg>
                Sign up with MetaMask
              </button>
              <p className="form-footer-note">By creating an account you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</p>
            </div>
          )}

          {/* Wallet Role Selection Modal */}
          {walletRoleModal && (
            <div className="modal-overlay open" onClick={() => setWalletRoleModal(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
                <div className="modal-title">Choose Your Role</div>
                <p className="modal-subtitle">How would you like to use FreeLedger?</p>
                <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: 20, flexDirection: 'column', gap: 8 }} onClick={() => handleWalletRoleConfirm('client')}>
                    <span style={{ fontSize: 28 }}>🏢</span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Client</span>
                    <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>I hire talent</span>
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1, padding: 20, flexDirection: 'column', gap: 8, background: 'var(--green)' }} onClick={() => handleWalletRoleConfirm('freelancer')}>
                    <span style={{ fontSize: 28 }}>💼</span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Freelancer</span>
                    <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>I offer my skills</span>
                  </button>
                </div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={() => setWalletRoleModal(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
