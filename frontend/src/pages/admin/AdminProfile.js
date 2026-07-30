import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import TOTPSettings from '../../components/shared/TOTPSettings.js';
import '../../css/admin/profile.css';

export default function AdminProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    emailNotifications: true,
  });
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/users/me');
        setForm({
          name: data.username || '',
          email: data.email || '',
          emailNotifications: data.email_notifications !== false,
        });
      } catch {
        const saved = JSON.parse(localStorage.getItem('admin_profile') || '{}');
        setForm(f => ({
          ...f,
          name: saved.name || f.name,
          email: saved.email || f.email,
        }));
      }
    })();
  }, []);

  const showToast = (msg, icon = '\u2705') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/users/me', {
        username: form.name || undefined,
        email: form.email || undefined,
        email_notifications: form.emailNotifications,
      });
      localStorage.setItem('user', JSON.stringify(data));
      showToast('Profile saved!');
    } catch (e) {
      showToast('Failed to save. Try again.', '\u26a0\ufe0f');
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'AD';

  return (
    <div className="page-body">
      {toast && (
        <div className={`toast show`} style={{ background: toast.icon === '\u2705' ? '#101828' : '#7f1d1d' }}>
          <span className="toast-icon">{toast.icon}</span> {toast.msg}
        </div>
      )}

      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <h1 className="page-title">Admin Settings</h1>
          <p className="page-sub">Manage your account and security preferences</p>
        </div>
        <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>

      <div className="admin-profile-layout">
        <div>
          <div className="admin-profile-card">
            <div className="admin-profile-banner"></div>
            
            <div className="admin-profile-avatar-container">
              <div className="admin-profile-avatar-lg">{initials}</div>
            </div>

            <div className="admin-profile-name">{form.name || 'Admin User'}</div>
            <div className="admin-profile-email">{form.email}</div>
            
            <div style={{ display: 'inline-flex' }}>
              <span className="role-badge admin">System Administrator</span>
            </div>
            
            <div className="admin-shield">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              Account Secured
            </div>
          </div>
        </div>

        <div>
          <div className="admin-profile-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Basic Information
            </h3>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Admin username"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>
          </div>

          <div className="admin-profile-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              Notifications
            </h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.emailNotifications}
                onChange={e => setForm({ ...form, emailNotifications: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: 'var(--landing-blue, #2457e6)' }}
              />
              <span style={{ color: 'var(--landing-text, #475467)' }}>Email notifications for new disputes and critical system alerts</span>
            </label>
          </div>

          <div className="admin-profile-section" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '32px 32px 0 32px' }}>
              <h3 style={{ marginBottom: 16 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Two-Factor Authentication
              </h3>
            </div>
            <div style={{ padding: '0 32px 32px 32px' }}>
              <TOTPSettings />
            </div>
          </div>
          
          <button className="btn btn-primary" style={{ width: '100%', height: 52, fontSize: 15 }} onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
