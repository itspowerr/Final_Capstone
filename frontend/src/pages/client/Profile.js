import { useState, useEffect } from 'react';
import Navbar from '../../components/client/Navbar';
import { getProvider } from '../../services/web3.js';
import { useApp } from '../../context/AppContext';
import api from '../../services/api';
import '../../css/client/profile.css';

const quickSkills = ['React', 'Node.js', 'Solidity', 'Web3.js', 'Figma', 'Python', 'TypeScript', 'UI/UX', 'Marketing', 'Writing'];

export default function ClientProfile() {
  const { walletAddress, setUser, connectWallet, disconnectWallet } = useApp();
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
          github: '',
          linkedin: '',
          portfolio: '',
          emailNotifications: true,
          twoFactor: false,
        });
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
        connectWallet(accounts[0]);
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

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/users/me', {
        username: form.name || undefined,
        email: form.email || undefined,
        bio: form.bio || undefined,
        skills: form.skills.length > 0 ? form.skills : undefined,
        hourly_rate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
      });
      setUser(data);
      showToast('Profile saved to server!');
    } catch (e) {
      const p = {
        name: form.name, email: form.email, bio: form.bio, skills: form.skills,
        hourlyRate: form.hourlyRate, github: form.github, linkedin: form.linkedin,
        portfolio: form.portfolio, emailNotifications: form.emailNotifications,
        twoFactor: form.twoFactor,
      };
      localStorage.setItem('client_profile', JSON.stringify(p));
      showToast('Saved locally (server unavailable)', '⚠️');
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
        <div className="dash-body"><p style={{ padding: 40, color: 'var(--text-3)' }}>Loading profile...</p></div>
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
            <div className="profile-card">
              <div className="profile-avatar-lg">{initials}</div>
              <div className="profile-name">{form.name || 'Your Name'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>{form.email}</div>
              <span className="role-badge client" style={{ marginBottom: 16 }}>Client</span>
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
              <h3>Basic Information</h3>
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
              <h3>Professional</h3>
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
              <h3>Portfolio & Links</h3>
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
              <h3>Wallet</h3>
              {walletAddress ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Connected:</span>
                    <code style={{ fontSize: 13, background: 'var(--bg-2)', padding: '4px 8px', borderRadius: 6 }}>
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </code>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={disconnectWallet}>Disconnect</button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>
                    Connect your MetaMask wallet to post projects on-chain.
                  </p>
                  {walletError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{walletError}</p>}
                  <button className="btn btn-primary btn-sm" onClick={handleConnectWallet}>
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>

            <div className="profile-section">
              <h3>Notifications</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.emailNotifications} onChange={e => setForm({ ...form, emailNotifications: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  Email notifications for new proposals and messages
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.twoFactor} onChange={e => setForm({ ...form, twoFactor: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  Enable two-factor authentication
                </label>
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast show">
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}
