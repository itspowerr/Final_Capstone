import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/freelancer/Navbar';
import { SkeletonCard, SkeletonLine } from '../../components/shared/Skeleton';
import api from '../../services/api';
import { getIPFSGatewayUrl } from '../../services/ipfs';
import TOTPSettings from '../../components/shared/TOTPSettings';
import '../../css/freelancer/dashboard.css';
import '../../css/freelancer/profile.css';

export default function MyProfile() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [github, setGithub] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experience, setExperience] = useState('mid');
  const [availability, setAvailability] = useState('available');
  const [skills, setSkills] = useState([]);
  const [wallet, setWallet] = useState('');
  const [contracts, setContracts] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [avatarCid, setAvatarCid] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/users/me');
        setFullName(data.username || '');
        setTitle(data.headline || '');
        setBio(data.bio || '');
        setSkills(data.skills || []);
        setHourlyRate(data.hourly_rate || '');
        setExperience(data.experience_level || 'mid');
        setAvailability(data.is_available ? 'available' : 'busy');
        setWallet(data.wallet_address || '');
        setLocation(data.location || '');
        setGithub(data.github_url || '');
        setPortfolio(data.portfolio_url || '');
        setLinkedin(data.linkedin_url || '');
        setAvatarCid(data.avatar_cid || '');
      } catch {
        const saved = JSON.parse(localStorage.getItem('fl_freelancer_profile') || '{}');
        setFullName(saved.fullName || '');
        setTitle(saved.title || '');
        setBio(saved.bio || '');
        setLocation(saved.location || '');
        setGithub(saved.github || '');
        setPortfolio(saved.portfolio || '');
        setLinkedin(saved.linkedin || '');
        setHourlyRate(saved.hourlyRate || '');
        setExperience(saved.experience || 'mid');
        setAvailability(saved.availability || 'available');
        setSkills(saved.skills || []);
        setWallet(saved.wallet || '');
      }
      try {
        const { data: contractData } = await api.get('/contracts');
        setContracts(Array.isArray(contractData.contracts) ? contractData.contracts : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  function showToast(msg, icon) {
    setToast({ msg, icon: icon || '✅' });
    setTimeout(() => setToast(null), 2500);
  }

  function addSkill() {
    const val = skillInput.trim();
    if (!val) return;
    if (!skills.map(s => s.toLowerCase()).includes(val.toLowerCase())) {
      setSkills([...skills, val]);
    }
    setSkillInput('');
  }

  function addSkillQuick(skill) {
    if (!skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())) {
      setSkills([...skills, skill]);
    }
  }

  function removeSkill(skill) {
    setSkills(skills.filter(s => s !== skill));
  }

  async function handleAvatarUpload(e) {
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
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await api.put('/users/me', {
        username: fullName || null,
        headline: title || null,
        bio: bio || null,
        skills: skills,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : 0,
        experience_level: experience || 'mid',
        is_available: availability === 'available',
        location: location || null,
        github_url: github || null,
        linkedin_url: linkedin || null,
        portfolio_url: portfolio || null,
        wallet_address: wallet || null,
        avatar_cid: avatarCid || null,
      });
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        if (fullName) u.username = fullName;
        localStorage.setItem('user', JSON.stringify(u));
      }
      showToast('✨ Your professional profile is now live and updated!', '🚀');
    } catch {
      showToast('Failed to save. Try again.', '⚠️');
    } finally {
      setSaving(false);
    }
  }

  async function connectMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const addr = accounts[0];
        try {
          const { data } = await api.put('/users/me', { wallet_address: addr });
          setWallet(data.wallet_address);
          showToast('Wallet connected: ' + addr.slice(0, 6) + '…' + addr.slice(-4));
        } catch (err) {
          const detail = err.response?.data?.detail;
          const msg = typeof detail === 'string' ? detail : detail?.message || 'This wallet is already connected';
          showToast(msg, '⚠️');
        }
      } catch (_) { showToast('MetaMask cancelled.', '❌'); }
    } else {
      showToast('MetaMask not found. Install at metamask.io', '⚠️');
    }
  }

  async function disconnectMetaMask() {
    try {
      await api.put('/users/me', { wallet_address: null });
      setWallet('');
      showToast('Wallet disconnected successfully.', '🔌');
    } catch (err) {
      showToast('Failed to disconnect wallet.', '⚠️');
    }
  }

  const completed = contracts.filter(c => c.status === 'completed');
  const earned = completed.reduce((s, c) => s + (Number(c.total_amount) || 0), 0);

  const availStyle = {
    available: { label: '✅ Available for work', bg: '#ecfdf3', color: '#027a48', border: '1px solid #abefc6' },
    busy: { label: '🔴 Currently busy', bg: '#fef3f2', color: '#b42318', border: '1px solid #fecaca' },
    part: { label: '🟡 Part-time only', bg: '#fffaeb', color: '#b54708', border: '1px solid #fef0c7' },
  }[availability] || { label: '✅ Available for work', bg: '#ecfdf3', color: '#027a48', border: '1px solid #abefc6' };

  const nameDisplay = fullName || 'Unnamed';
  const initials = nameDisplay.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const walletDisplay = wallet ? wallet.slice(0, 8) + '...' + wallet.slice(-6) : 'No wallet connected';
  const rating = completed.length > 0 ? (3.5 + completed.length * 0.3).toFixed(1) : '—';

  const quickSkills = ['Solidity', 'React', 'Web3.js', 'Ethers.js', 'Figma', 'Node.js', 'TypeScript', 'IPFS', 'Hardhat', 'Python', 'Vue.js', 'PostgreSQL'];

  const expLevels = ['junior', 'mid', 'senior', 'lead'];
  const expLabels = { junior: 'Entry Level', mid: 'Intermediate', senior: 'Senior', lead: 'Lead' };

  if (loading) {
    return (
      <div style={{ background: 'var(--landing-mist)', minHeight: '100vh' }}>
        <Navbar activePage="profile" />
        <div className="page-body" style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            <div className="skeleton-circle" style={{ width: 120, height: 120, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <SkeletonLine width="40%" height={24} />
              <SkeletonLine width="25%" height={16} style={{ marginTop: 12 }} />
            </div>
          </div>
          <SkeletonCard rows={5} />
          <div style={{ marginTop: 24 }}>
            <SkeletonCard rows={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--landing-mist)', minHeight: '100vh' }}>
      <Navbar activePage="profile" />
      <div className="page-body">
        <div className="page-header" style={{ marginBottom: 32 }}>
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-sub">Your decentralized identity — visible to clients on the platform</p>
          </div>
          <button className="btn btn-primary" style={{ padding: '0 24px' }} onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>

        <div className="fl-profile-layout">
          <div>
            <div className="fl-profile-card" style={{ padding: 0 }}>
              <div className="fl-profile-banner"></div>
              
              <div className="fl-profile-avatar-container">
                <label style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                  {avatarCid ? (
                    <img className="fl-profile-avatar-img" src={getIPFSGatewayUrl(avatarCid)} alt={`${fullName || 'User'} profile`} width="120" height="120" decoding="async" />
                  ) : (
                    <div className="fl-profile-avatar-lg">{initials}</div>
                  )}
                  <div className="fl-profile-upload-btn">
                    {uploadingAvatar ? '⏳' : '📷'}
                  </div>
                </label>
              </div>

              <div className="fl-profile-name">{nameDisplay}</div>
              <div className="fl-profile-title">{title || 'Add your professional title'}</div>
              
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 800, background: availStyle.bg, color: availStyle.color, border: availStyle.border, marginBottom: 20 }}>
                {availStyle.label}
              </div>
              
              <div style={{ display: 'block', padding: '0 20px' }}>
                <div className="fl-profile-wallet">{walletDisplay}</div>
              </div>
              
              <div className="fl-profile-stats">
                <div className="fl-pstat"><div className="val">{contracts.length}</div><div className="lbl">Contracts</div></div>
                <div className="fl-pstat"><div className="val">{earned > 0 ? earned.toLocaleString() + ' ETH' : '0 ETH'}</div><div className="lbl">Earned</div></div>
                <div className="fl-pstat"><div className="val">{skills.length}</div><div className="lbl">Skills</div></div>
                <div className="fl-pstat"><div className="val">{rating}</div><div className="lbl">Rating</div></div>
              </div>
            </div>
          </div>

          <div>
            <div className="fl-profile-section">
              <h2>Work Preferences</h2>
              <div className="form-group">
                <label className="form-label">Availability Status</label>
                <select className="form-input" value={availability} onChange={e => setAvailability(e.target.value)}>
                  <option value="available">✅ Available for work</option>
                  <option value="busy">🔴 Currently busy</option>
                  <option value="part">🟡 Part-time only</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Hourly Rate (ETH)</label>
                <input className="form-input" type="number" placeholder="e.g. 0.05" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
              </div>
            </div>

            <div className="fl-profile-section">
              <h2>Basic Information</h2>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Professional Title</label>
                  <input className="form-input" placeholder="e.g. Full Stack Web3 Developer" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea className="form-input" rows="4" placeholder="Describe your expertise, the kinds of projects you enjoy, and what you bring to the table..." style={{ resize: 'vertical' }} value={bio} onChange={e => setBio(e.target.value)}></textarea>
              </div>
              <div className="form-row" style={{marginBottom: 0}}>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Location</label>
                  <input className="form-input" placeholder="e.g. Kathmandu, Nepal" value={location} onChange={e => setLocation(e.target.value)} />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Experience Level</label>
                  <select className="form-input" value={experience} onChange={e => setExperience(e.target.value)}>
                    {expLevels.map(l => (
                      <option key={l} value={l}>{expLabels[l]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="fl-profile-section">
              <h2>Skills</h2>
              <div className="fl-skills-list">
                {skills.length === 0 ? (
                  <span style={{ fontSize: 14, color: 'var(--landing-muted)' }}>No skills added yet.</span>
                ) : skills.map(s => (
                  <span key={s} className="fl-skill-pill">{s}<button onClick={() => removeSkill(s)} title="Remove">×</button></span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <input className="form-input" placeholder="Add a skill (e.g. Solidity, React, Figma...)" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { addSkill(); e.preventDefault(); } }} />
                <button className="btn btn-primary" style={{padding: '0 20px'}} onClick={addSkill}>Add Skill</button>
              </div>
              <div style={{ marginTop: 16, lineHeight: 2.2 }}>
                <span style={{ fontSize: 13, color: 'var(--landing-text)', fontWeight: 600, marginRight: 8 }}>Quick add: </span>
                {quickSkills.map(s => (
                  <button key={s} className="fl-quick-skill-btn" onClick={() => addSkillQuick(s)}>{s}</button>
                ))}
              </div>
            </div>

            <div className="fl-profile-section">
              <h2>Portfolio & Links</h2>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">GitHub</label>
                  <input className="form-input" placeholder="https://github.com/username" value={github} onChange={e => setGithub(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Portfolio Website</label>
                  <input className="form-input" placeholder="https://yoursite.com" value={portfolio} onChange={e => setPortfolio(e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">LinkedIn</label>
                <input className="form-input" placeholder="https://linkedin.com/in/username" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
              </div>
            </div>

            <div className="fl-profile-section">
              <h2>Web3 Identity</h2>
              <p style={{ fontSize: 14, color: 'var(--landing-text)', marginBottom: 20, lineHeight: 1.5 }}>Connect your MetaMask wallet to establish your decentralized on-chain identity. Your wallet address acts as your cryptographic ID across the platform.</p>
              
              <div className="web3-id-card">
                <div className="web3-id-card-title">Cryptographic Passport</div>
                {wallet ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 4px rgba(16,185,129,0.2)' }}></div>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>Connected</span>
                    </div>
                    <div className="web3-id-card-wallet">{wallet}</div>
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
              
              {wallet ? (
                <button className="btn btn-outline" style={{width: '100%', height: 48, fontSize: 15, borderColor: '#ef4444', color: '#ef4444'}} onClick={disconnectMetaMask}>
                  Disconnect Wallet
                </button>
              ) : (
                <button className="btn btn-outline" style={{width: '100%', height: 48, fontSize: 15}} onClick={connectMetaMask}>
                  <svg width="20" height="20" viewBox="0 0 35 33" fill="none" style={{ marginRight: 8 }}>
                    <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726"/>
                    <path d="M2.04187 1L15.0646 10.8048L12.7336 4.99098L2.04187 1Z" fill="#E27625"/>
                    <path d="M28.1341 23.5433L24.6903 28.9135L32.2169 30.9913L34.3577 23.6586L28.1341 23.5433Z" fill="#E27625"/>
                    <path d="M0.657715 23.6586L2.78397 30.9913L10.2974 28.9135L6.86665 23.5433L0.657715 23.6586Z" fill="#E27625"/>
                  </svg>
                  Connect MetaMask
                </button>
              )}
            </div>

            <div style={{marginBottom: 24}}>
              <TOTPSettings />
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <button className="btn btn-outline" style={{ flex: 1, height: 52, fontSize: 15 }} onClick={() => navigate('/freelancer/dashboard')}>Back to Dashboard</button>
              <button className="btn btn-primary" style={{ flex: 1, height: 52, fontSize: 15 }} onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast show" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#101828', color: '#fff', padding: '12px 24px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 12px 32px rgba(16,24,40,0.2)',
          fontFamily: "var(--landing-body)", fontSize: 14, fontWeight: 700, zIndex: 9999
        }}>
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
