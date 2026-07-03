/* eslint-disable jsx-a11y/anchor-is-valid */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import api from '../services/api.js';
import useAuth from '../hooks/useAuth';

const panels = {
  login: {
    title: 'Welcome back to the decentralized economy',
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
    title: 'Start your decentralized journey today',
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

export default function Login() {
  const navigate = useNavigate();
  const { connectAndCheck } = useAuth();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('freelancer');
  const [loginRole, setLoginRole] = useState('client');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletRoleModal, setWalletRoleModal] = useState(false);
  const [walletPending, setWalletPending] = useState(null);

  const panel = panels[tab];

  const validateLogin = () => {
    const errs = {};
    if (!email || !email.includes('@')) errs.email = 'Please enter a valid email.';
    if (!password) errs.password = 'Password is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateRegister = () => {
    const errs = {};
    if (!firstName.trim()) errs.firstName = 'First name is required.';
    if (!email || !email.includes('@')) errs.email = 'Please enter a valid email.';
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
      const { access_token, refresh_token, user } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate(user.role === 'client' ? '/client/dashboard' : '/freelancer/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail : detail?.message || err.message || 'Login failed';
      setError(errorMsg);
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
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail : detail?.message || err.message || 'Registration failed';
      setError(errorMsg);
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
      const result = await connectAndCheck();

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
            <h2>{panel.title}</h2>
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

          <div className="tab-switcher">
            <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
            <button className={`tab-btn ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Create Account</button>
          </div>

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

          {tab === 'login' ? (
            <div className="form-panel active">
              <p className="subtitle">Don't have an account? <a onClick={() => setTab('register')}>Create one →</a></p>
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  {errors.email && <div className="error-msg visible">{errors.email}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Password
                    <a href="#" style={{ fontWeight: 500, color: 'var(--blue)', fontSize: 12 }} onClick={(e) => e.preventDefault()}>Forgot?</a>
                  </label>
                  <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
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
              <form onSubmit={handleRegister}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input className="form-input" type="text" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                    {errors.firstName && <div className="error-msg visible">{errors.firstName}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input className="form-input" type="text" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  {errors.email && <div className="error-msg visible">{errors.email}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
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
