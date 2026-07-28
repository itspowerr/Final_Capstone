import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Navbar from '../../components/client/Navbar';
import { getProvider } from '../../services/web3.js';
import { useApp } from '../../context/AppContext';
import { SkeletonCard, SkeletonLine } from '../../components/shared/Skeleton';
import api from '../../services/api';
import { getIPFSGatewayUrl } from '../../services/ipfs';
import TOTPSettings from '../../components/shared/TOTPSettings';
import '../../css/client/profile.css';

const quickSkills = ['React', 'Node.js', 'Solidity', 'Web3.js', 'Figma', 'Python', 'TypeScript', 'UI/UX', 'Marketing', 'Writing'];

export default function ClientProfile() {
  const { walletAddress, user, setUser, connectWallet, disconnectWallet } = useApp();
  const [walletError, setWalletError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: '',
    email: '',
    bio: '',
    skills: [],
    hourlyRate: '',
    github: '',
    linkedin: '',
    portfolio: '',
    emailNotifications: true,
    twoFactor: false,
  });
  const [skillInput, setSkillInput] = useState('');
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [avatarCid, setAvatarCid] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/users/me');
        setForm({
          name: data.username || '',
          email: data.email || '',
          bio: data.bio || '',
          skills: data.skills || [],
          hourlyRate: data.hourly_rate || '',
          github: data.github_url || '',
          linkedin: data.linkedin_url || '',
          portfolio: data.portfolio_url || '',
          emailNotifications: data.email_notifications !== false,
          twoFactor: false,
        });
        setAvatarCid(data.avatar_cid || '');
      } catch {
        const saved = JSON.parse(localStorage.getItem('client_profile') || '{}');
        setForm(f => ({ ...f, ...saved }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConnectWallet = async () => {
    setWalletError(null);
    try {
      const provider = getProvider();
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts.length > 0) {
        try {
          const { data } = await api.put('/users/me', { wallet_address: accounts[0] });
          connectWallet(data.wallet_address);
        } catch (err) {
          const detail = err.response?.data?.detail;
          const msg = typeof detail === 'string' ? detail : detail?.message || 'This wallet is already connected';
          setWalletError(msg);
        }
      }
    } catch (e) {
      setWalletError(e.message || 'Failed to connect wallet');
    }
  };

  const showToast = (msg, icon) => {
    setToast({ msg, icon: icon || '✅' });
    setTimeout(() => setToast(null), 2500);
  };

  const addSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    if (!form.skills.map(s => s.toLowerCase()).includes(val.toLowerCase())) {
      setForm({ ...form, skills: [...form.skills, val] });
    }
    setSkillInput('');
  };

  const addSkillQuick = (skill) => {
    if (!form.skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())) {
      setForm({ ...form, skills: [...form.skills, skill] });
    }
  };

  const removeSkill = (skill) => {
    setForm({ ...form, skills: form.skills.filter(s => s !== skill) });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', '⚠️');
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/ipfs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarCid(data.cid);
      await api.put('/users/me', { avatar_cid: data.cid });
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          u.avatar_cid = data.cid;
          localStorage.setItem('user', JSON.stringify(u));
        }
      } catch {}
      window.dispatchEvent(new Event('avatar-updated'));
      showToast('Profile picture updated!');
    } catch (err) {
      showToast(err.response?.data?.detail?.message || 'Failed to upload', '⚠️');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/users/me', {
        username: form.name || null,
        email: form.email || null,
        bio: form.bio || null,
        skills: form.skills,
        hourly_rate: form.hourlyRate ? parseFloat(form.hourlyRate) : 0,
        github_url: form.github || null,
        linkedin_url: form.linkedin || null,
        portfolio_url: form.portfolio || null,
        avatar_cid: avatarCid || null,
        email_notifications: form.emailNotifications,
      });
      setUser(data);
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        if (form.name) u.username = form.name;
        localStorage.setItem('user', JSON.stringify(u));
      }
      showToast('✨ Your professional profile is now live and updated!', '🚀');
    } catch (e) {
      showToast('Failed to save. Try again.', '⚠️');
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const stats = { contracts: 5, spent: 12400, rating: 4.9 };

  if (loading) {
    return (
      <>
        <Navbar activePage="profile" />
        <div className="dash-body" style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            <div className="skeleton-circle" style={{ width: 80, height: 80, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <SkeletonLine width="40%" height={20} />
              <SkeletonLine width="25%" height={14} style={{ marginTop: 8 }} />
            </div>
          </div>
          <SkeletonCard rows={4} />
          <div style={{ marginTop: 20 }}>
            <SkeletonCard rows={2} />
          </div>
          <div style={{ marginTop: 20 }}>
            <SkeletonCard rows={3} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar activePage="profile" />
      <div className="dash-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">Profile</h1>
            <p className="page-sub">Manage your <span>account and preferences</span></p>
          </div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="profile-layout">
          <div>
            <div className="profile-card" style={{ padding: 0 }}>
              <div className="profile-banner"></div>
              
              <div className="profile-avatar-container">
                <label style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                  {avatarCid ? (
                    <img className="profile-avatar-img" src={getIPFSGatewayUrl(avatarCid)} alt={`${form.name || 'User'} profile`} width="120" height="120" decoding="async" />
                  ) : (
                    <div className="profile-avatar-lg">{initials}</div>
                  )}
                  <div className="profile-upload-btn">
                    {uploadingAvatar ? '⏳' : '📷'}
                  </div>
                </label>
              </div>

              <div className="profile-name">{form.name || 'Your Name'}</div>
              <div className="profile-email">{form.email}</div>
              
              <div style={{ display: 'inline-flex' }}>
                <span className="role-badge client">Client</span>
              </div>
              
              <div className="profile-stats">
                <div className="pstat"><div className="val">{stats.contracts}</div><div className="lbl">Contracts</div></div>
                <div className="pstat"><div className="val">{stats.spent.toLocaleString()} ETH</div><div className="lbl">Spent</div></div>
                <div className="pstat"><div className="val">{form.skills.length}</div><div className="lbl">Skills</div></div>
                <div className="pstat"><div className="val">{stats.rating}</div><div className="lbl">Rating</div></div>
              </div>
            </div>
          </div>

          <div>
            <div className="profile-section">
              <h2>Basic Information</h2>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" type="text" placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="profile-section">
              <h2>Professional</h2>
              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea className="form-input" rows={4} placeholder="Describe your background, what you're looking for, and the types of projects you want to fund..." style={{ resize: 'vertical' }} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}></textarea>
              </div>
              <div className="form-group">
                <label className="form-label">Hourly Rate Budget ($)</label>
                <input className="form-input" type="number" placeholder="e.g. 50" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Skills</label>
                <div className="skills-list">
                  {form.skills.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>No skills added yet.</span>
                  ) : form.skills.map(s => (
                    <span key={s} className="skill-pill">{s}<button onClick={() => removeSkill(s)} title="Remove">×</button></span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input className="form-input" placeholder="Add a skill (e.g. Solidity, React…)" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { addSkill(); e.preventDefault(); } }} />
                  <button className="btn btn-primary btn-sm" onClick={addSkill}>+ Add</button>
                </div>
                <div style={{ marginTop: 10, lineHeight: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Quick add: </span>
                  {quickSkills.map(s => (
                    <button key={s} className="quick-skill-btn" onClick={() => addSkillQuick(s)}>{s}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="profile-section">
              <h2>Portfolio & Links</h2>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">GitHub</label>
                  <input className="form-input" placeholder="https://github.com/username" value={form.github} onChange={e => setForm({ ...form, github: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Portfolio Website</label>
                  <input className="form-input" placeholder="https://yoursite.com" value={form.portfolio} onChange={e => setForm({ ...form, portfolio: e.target.value })} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">LinkedIn</label>
                <input className="form-input" placeholder="https://linkedin.com/in/username" value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} />
              </div>
            </div>

            <div className="profile-section">
              <h2>Web3 Identity</h2>
              <p style={{ fontSize: 14, color: 'var(--landing-text)', marginBottom: 20, lineHeight: 1.5 }}>Connect your MetaMask wallet to establish your decentralized on-chain identity. Your wallet address acts as your cryptographic ID across the platform.</p>
              
              <div className="web3-id-card">
                <div className="web3-id-card-title">Cryptographic Passport</div>
                {walletAddress ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 4px rgba(16,185,129,0.2)' }}></div>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>Connected</span>
                    </div>
                    <div className="web3-id-card-wallet">{walletAddress}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 4px rgba(239,68,68,0.2)' }}></div>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>Disconnected</span>
                    </div>
                    <div className="web3-id-card-wallet" style={{ opacity: 0.5 }}>No Wallet Connected</div>
                  </div>
                )}
              </div>
              
              {walletAddress ? (
                <button className="btn btn-outline" style={{width: '100%', height: 48, fontSize: 15, borderColor: '#ef4444', color: '#ef4444'}} onClick={disconnectWallet}>
                  Disconnect Wallet
                </button>
              ) : (
                <>
                  {walletError && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{walletError}</p>}
                  <button className="btn btn-outline" style={{width: '100%', height: 48, fontSize: 15}} onClick={handleConnectWallet}>
                    <svg width="20" height="20" viewBox="0 0 35 33" fill="none" style={{ marginRight: 8 }}>
                      <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726"/>
                      <path d="M2.04187 1L15.0646 10.8048L12.7336 4.99098L2.04187 1Z" fill="#E27625"/>
                      <path d="M28.1341 23.5433L24.6903 28.9135L32.2169 30.9913L34.3577 23.6586L28.1341 23.5433Z" fill="#E27625"/>
                      <path d="M0.657715 23.6586L2.78397 30.9913L10.2974 28.9135L6.86665 23.5433L0.657715 23.6586Z" fill="#E27625"/>
                    </svg>
                    Connect MetaMask
                  </button>
                </>
              )}
            </div>

            <div className="profile-section">
              <h2>Notifications</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.emailNotifications} onChange={e => setForm({ ...form, emailNotifications: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--landing-navy, #101828)' }} />
                  <span style={{ color: 'var(--landing-text, #475467)' }}>Email notifications for new proposals and messages</span>
                </label>
              </div>
            </div>

            <div className="profile-section" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '32px 32px 0 32px' }}>
                <h3 style={{ marginBottom: 16 }}>Two-Factor Authentication</h3>
              </div>
              <div style={{ padding: '0 32px 32px 32px' }}>
                <TOTPSettings />
              </div>
            </div>

            <button className="btn btn-primary btn-full" style={{ height: 52, fontSize: 15 }} onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </div>
      </div>

      {toast && createPortal(
        <div className="toast show">
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>,
        document.body
      )}
    </>
  );
}
