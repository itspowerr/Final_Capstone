import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/freelancer/Navbar';
import api from '../../services/api';

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
  const [skillInput, setSkillInput] = useState('');

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
      } finally {
        setLoading(false);
      }
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

  async function saveProfile() {
    try {
      await api.put('/users/me', {
        username: fullName || undefined,
        headline: title || undefined,
        bio: bio || undefined,
        skills: skills.length > 0 ? skills : undefined,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        experience_level: experience || undefined,
        is_available: availability === 'available',
      });
      showToast('Profile saved to server!');
    } catch {
      const p = {
        fullName, title, bio, location, github, portfolio, linkedin,
        hourlyRate, experience, availability, skills, wallet,
      };
      localStorage.setItem('fl_freelancer_profile', JSON.stringify(p));
      showToast('Saved locally (server unavailable)', '⚠️');
    }
  }

  async function connectMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWallet(accounts[0]);
        showToast('Wallet connected: ' + accounts[0].slice(0, 6) + '…' + accounts[0].slice(-4));
      } catch (_) { showToast('MetaMask cancelled.', '❌'); }
    } else {
      showToast('MetaMask not found. Install at metamask.io', '⚠️');
    }
  }

  const contracts = JSON.parse(localStorage.getItem('fl_my_contracts') || '[]');
  const completed = contracts.filter(c => c.status === 'completed');
  const earned = completed.reduce((s, c) => s + (c.value || 0), 0);

  const availStyle = {
    available: { label: '✅ Available', bg: 'var(--accent-pale)', color: 'var(--accent)', border: '1px solid var(--accent-border)' },
    busy: { label: '🔴 Busy', bg: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
    part: { label: '🟡 Part-time', bg: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' },
  }[availability] || { label: '✅ Available', bg: 'var(--accent-pale)', color: 'var(--accent)', border: '1px solid var(--accent-border)' };

  const nameDisplay = fullName || 'Unnamed';
  const initials = nameDisplay.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const walletDisplay = wallet ? wallet.slice(0, 8) + '…' + wallet.slice(-6) : 'No wallet connected';
  const rating = completed.length > 0 ? (3.5 + completed.length * 0.3).toFixed(1) : '—';

  const quickSkills = ['Solidity', 'React', 'Web3.js', 'Ethers.js', 'Figma', 'Node.js', 'TypeScript', 'IPFS', 'Hardhat', 'Python', 'Vue.js', 'PostgreSQL'];

  const expLevels = ['junior', 'mid', 'senior', 'lead'];
  const expLabels = { junior: 'Entry Level', mid: 'Intermediate', senior: 'Senior', lead: 'Lead' };

  if (loading) {
    return (
      <div>
        <Navbar activePage="profile" />
        <div className="page-body"><p style={{ padding: 40, color: 'var(--text-3)' }}>Loading profile...</p></div>
      </div>
    );
  }

  return (
    <div>
      <Navbar activePage="profile" />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-sub">Your decentralized identity — visible to clients on the platform</p>
          </div>
          <button className="btn btn-primary" onClick={saveProfile}>Save Changes</button>
        </div>

        <div className="fl-profile-layout">
          <div>
            <div className="fl-profile-card">
              <div className="fl-profile-avatar-lg">{initials}</div>
              <div className="fl-profile-name">{nameDisplay}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>{title || 'Add your title'}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: availStyle.bg, color: availStyle.color, border: availStyle.border, marginBottom: 16 }}>
                {availStyle.label}
              </div>
              <div className="fl-profile-wallet">{walletDisplay}</div>
              <div className="fl-profile-stats">
                <div className="fl-pstat"><div className="val">{contracts.length}</div><div className="lbl">Contracts</div></div>
                <div className="fl-pstat"><div className="val">{earned > 0 ? '$' + earned.toLocaleString() : '$0'}</div><div className="lbl">Earned</div></div>
                <div className="fl-pstat"><div className="val">{skills.length}</div><div className="lbl">Skills</div></div>
                <div className="fl-pstat"><div className="val">{rating}</div><div className="lbl">Rating</div></div>
              </div>
            </div>

            <div className="fl-profile-section">
              <h3>Work Preferences</h3>
              <div className="form-group">
                <label className="form-label">Availability Status</label>
                <select className="form-input" value={availability} onChange={e => setAvailability(e.target.value)}>
                  <option value="available">✅ Available for work</option>
                  <option value="busy">🔴 Currently busy</option>
                  <option value="part">🟡 Part-time only</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Hourly Rate ($)</label>
                <input className="form-input" type="number" placeholder="e.g. 45" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <div className="fl-profile-section">
              <h3>Basic Information</h3>
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
                <textarea className="form-input" rows="4" placeholder="Describe your expertise, the kinds of projects you enjoy, and what you bring to the table…" style={{ resize: 'vertical' }} value={bio} onChange={e => setBio(e.target.value)}></textarea>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" placeholder="e.g. Kathmandu, Nepal" value={location} onChange={e => setLocation(e.target.value)} />
                </div>
                <div className="form-group">
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
              <h3>Skills</h3>
              <div className="fl-skills-list">
                {skills.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>No skills added yet.</span>
                ) : skills.map(s => (
                  <span key={s} className="fl-skill-pill">{s}<button onClick={() => removeSkill(s)} title="Remove">×</button></span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="form-input" placeholder="Add a skill (e.g. Solidity, React, Figma…)" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { addSkill(); e.preventDefault(); } }} />
                <button className="btn btn-primary btn-sm" onClick={addSkill}>+ Add</button>
              </div>
              <div style={{ marginTop: 10, lineHeight: 2 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Quick add: </span>
                {quickSkills.map(s => (
                  <button key={s} className="fl-quick-skill-btn" onClick={() => addSkillQuick(s)}>{s}</button>
                ))}
              </div>
            </div>

            <div className="fl-profile-section">
              <h3>Portfolio & Links</h3>
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
              <h3>Wallet Identity (MetaMask)</h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Connect your MetaMask wallet to establish your decentralized on-chain identity. Your wallet address acts as your cryptographic ID across the platform — no username or password needed.</p>
              <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 14 }}>
                {wallet ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Wallet Connected</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: "'DM Mono', monospace" }}>{wallet}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No wallet connected</div>
                )}
              </div>
              <button className="btn btn-outline" onClick={connectMetaMask}>
                <svg width="18" height="18" viewBox="0 0 35 33" fill="none" style={{ marginRight: 4 }}>
                  <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726"/>
                  <path d="M2.04187 1L15.0646 10.8048L12.7336 4.99098L2.04187 1Z" fill="#E27625"/>
                  <path d="M28.1341 23.5433L24.6903 28.9135L32.2169 30.9913L34.3577 23.6586L28.1341 23.5433Z" fill="#E27625"/>
                  <path d="M0.657715 23.6586L2.78397 30.9913L10.2974 28.9135L6.86665 23.5433L0.657715 23.6586Z" fill="#E27625"/>
                </svg>
                Connect MetaMask
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveProfile}>Save Profile</button>
              <button className="btn btn-outline" onClick={() => navigate('/freelancer/dashboard')}>Back to Dashboard</button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast show">
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
