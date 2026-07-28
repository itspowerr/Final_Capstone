import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIPFSGatewayUrl } from '../../services/ipfs';
import '../../css/shared/account-menu.css';

export default function AccountMenu({ user, roleLabel, walletAddress, profilePath, onLogout }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const openProfile = () => {
    setOpen(false);
    navigate(profilePath);
  };

  const logout = () => {
    setOpen(false);
    onLogout();
  };

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className={`account-menu-trigger ${open ? 'open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-menu-info">
          <span className="account-menu-name">{user.name}</span>
          <span className="account-menu-role">{roleLabel}</span>
          {walletAddress && (
            <span className="account-menu-wallet">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
        </span>
        <span className="account-menu-avatar">
          {user.avatar_cid ? (
            <img src={getIPFSGatewayUrl(user.avatar_cid)} alt="" />
          ) : avatarLetter}
        </span>
        <svg className="account-menu-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div className={`account-menu-dropdown ${open ? 'open' : ''}`} role="menu" aria-hidden={!open}>
        <div className="account-menu-header">
          <span className="account-menu-avatar account-menu-avatar-large">
            {user.avatar_cid ? (
              <img src={getIPFSGatewayUrl(user.avatar_cid)} alt="" />
            ) : avatarLetter}
          </span>
          <span>
            <strong>{user.name}</strong>
            <small>{roleLabel} account</small>
          </span>
        </div>
        <div className="account-menu-divider" />
        <button type="button" className="account-menu-item" role="menuitem" tabIndex={open ? 0 : -1} onClick={openProfile}>
          <span className="account-menu-item-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span><strong>My Profile</strong><small>View and edit your account</small></span>
        </button>
        <button type="button" className="account-menu-item account-menu-logout" role="menuitem" tabIndex={open ? 0 : -1} onClick={logout}>
          <span className="account-menu-item-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
            </svg>
          </span>
          <span><strong>Log out</strong><small>End your current session</small></span>
        </button>
      </div>
    </div>
  );
}
