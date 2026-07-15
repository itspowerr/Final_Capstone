import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

export default function TOTPSettings() {
  const [status, setStatus] = useState({ enabled: false, has_secret: false });
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [step, setStep] = useState('idle');
  const [backupCodes, setBackupCodes] = useState(null);
  const [toast, setToast] = useState(null);
  const [backupLogin, setBackupLogin] = useState(() => localStorage.getItem('backup_login') === '1');
  const [resetting, setResetting] = useState(false);

  const showToast = (msg, icon) => {
    setToast({ msg, icon: icon || '+' });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/totp/status');
      setStatus(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSetup = async () => {
    setStep('loading');
    try {
      const { data } = await api.post('/auth/totp/setup');
      setSetupData(data);
      setStep('show_qr');
    } catch (err) {
      const msg = err.response?.data?.detail?.message || 'Failed to start setup';
      showToast(msg, '!');
      setStep('idle');
    }
  };

  const handleVerify = async () => {
    if (!verifyCode.trim()) return;
    setStep('loading');
    try {
      await api.post('/auth/totp/verify', { code: verifyCode.trim() });
      setBackupCodes(setupData.backup_codes);
      setStep('done');
      setStatus({ enabled: true, has_secret: true });
      setVerifyCode('');
      showToast('2FA enabled successfully!');
    } catch (err) {
      const msg = err.response?.data?.detail?.message || 'Invalid code';
      showToast(msg, '!');
      setStep('show_qr');
    }
  };

  const handleDisable = async () => {
    if (!disableCode.trim()) return;
    try {
      await api.post('/auth/totp/disable', { code: disableCode.trim() });
      setStatus({ enabled: false, has_secret: false });
      setDisableCode('');
      setStep('idle');
      showToast('2FA disabled');
    } catch (err) {
      const msg = err.response?.data?.detail?.message || 'Invalid code';
      showToast(msg, '!');
    }
  };

  const handleReset2FA = async () => {
    setResetting(true);
    try {
      await api.post('/auth/totp/reset');
      setStatus({ enabled: false, has_secret: false });
      setStep('idle');
      localStorage.removeItem('backup_login');
      setBackupLogin(false);
      showToast('2FA has been reset. You can set it up on a new device.');
    } catch (err) {
      const msg = err.response?.data?.detail?.message || 'Failed to reset 2FA';
      showToast(msg, '!');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>
        Loading 2FA status...
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <style>{`
        .totp-card {
          border: 1px solid var(--border); border-radius: 12px; padding: 24px;
          background: var(--white);
        }
        .totp-header {
          display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
        }
        .totp-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .totp-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
        }
        .totp-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
          margin: 16px 0;
        }
        .totp-grid-item {
          padding: 8px; text-align: center; font-family: monospace; font-size: 14px;
          font-weight: 700; background: var(--surface); border-radius: 6px;
          border: 1px solid var(--border); letter-spacing: 1px;
        }
      `}</style>

      <div className="totp-card">
        <div className="totp-header">
          <div className="totp-icon" style={{
            background: status.enabled ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Two-Factor Authentication</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Add an extra layer of security to your account
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            {status.enabled ? (
              <span className="totp-badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                Enabled
              </span>
            ) : (
              <span className="totp-badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                Disabled
              </span>
            )}
          </div>
        </div>

        {backupLogin && status.enabled && (
          <div style={{
            padding: '14px 16px', borderRadius: 8, marginBottom: 16,
            background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', fontSize: 13,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>&#9888;</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>You logged in with a backup code</div>
              <div style={{ lineHeight: 1.5 }}>
                Your authenticator device may be lost. Reset 2FA below to disable the old setup and configure a new device.
              </div>
              <button
                className="btn"
                onClick={handleReset2FA}
                disabled={resetting}
                style={{
                  marginTop: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  background: '#dc2626', color: '#fff', borderRadius: 6,
                }}
              >
                {resetting ? 'Resetting...' : 'Reset 2FA & Set Up New Device'}
              </button>
            </div>
          </div>
        )}

        {!status.enabled && step === 'idle' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              Protect your account with an authenticator app. Once enabled, you'll need to enter a 6-digit code from your phone each time you sign in.
            </p>
            <button className="btn btn-primary" onClick={handleSetup}>
              Enable 2FA
            </button>
          </div>
        )}

        {step === 'show_qr' && setupData && (
          <div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <img src={setupData.qr_code} alt="QR Code" style={{
                  width: 180, height: 180, borderRadius: 12, border: '1px solid var(--border)',
                }} />
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                  Scan with Microsoft Authenticator, Google Authenticator, or Authy
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Or enter this secret manually:</div>
                <div style={{
                  padding: '10px 14px', background: 'var(--surface)', borderRadius: 8,
                  fontFamily: 'monospace', fontSize: 14, fontWeight: 700, letterSpacing: 2,
                  border: '1px solid var(--border)', marginBottom: 16, wordBreak: 'break-all',
                }}>
                  {setupData.secret}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Enter the 6-digit code to verify:</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{
                      flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                      fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 4, textAlign: 'center',
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  />
                  <button className="btn btn-primary" onClick={handleVerify} style={{ flexShrink: 0 }}>
                    Verify
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && backupCodes && (
          <div>
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 16,
              background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 13,
            }}>
              2FA enabled! Save these backup codes somewhere safe. Each code can only be used once.
            </div>
            <div className="totp-grid">
              {backupCodes.map((code, i) => (
                <div className="totp-grid-item" key={i}>{code}</div>
              ))}
            </div>
            <button className="btn btn-outline" onClick={() => setBackupCodes(null)} style={{ marginTop: 8 }}>
              I've saved my codes
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div style={{ padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>
            Processing...
          </div>
        )}

        {status.enabled && step === 'idle' && !backupLogin && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              2FA is enabled. To disable it, enter the current code from your authenticator app.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={e => setDisableCode(e.target.value.replace(/[^0-9]/g, ''))}
                style={{
                  flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 4, textAlign: 'center',
                }}
                onKeyDown={e => e.key === 'Enter' && handleDisable()}
              />
              <button
                className="btn"
                onClick={handleDisable}
                style={{ background: '#dc2626', color: '#fff', flexShrink: 0 }}
              >
                Disable 2FA
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="toast show">
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
