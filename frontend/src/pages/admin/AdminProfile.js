import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import TOTPSettings from '../../components/shared/TOTPSettings.js';

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

  return (
    <div className="page-body">
      {toast && (
        <div className={`Toast Toast--${toast.icon === '\u2705' ? 'success' : 'error'}`}>
          <span>{toast.icon}</span> {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Settings</h1>
          <p className="page-sub">Manage your account and security preferences</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>

      {/* Basic Info */}
      <div className="dispute-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Account</h3>
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
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="admin@example.com"
          />
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={saveProfile}
          disabled={saving}
          style={{ marginTop: 4 }}
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Notifications */}
      <div className="dispute-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Notifications</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={form.emailNotifications}
            onChange={e => setForm({ ...form, emailNotifications: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
          />
          Email notifications for new disputes and system alerts
        </label>
      </div>

      {/* 2FA */}
      <div className="dispute-card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Two-Factor Authentication</h3>
        <TOTPSettings />
      </div>
    </div>
  );
}
