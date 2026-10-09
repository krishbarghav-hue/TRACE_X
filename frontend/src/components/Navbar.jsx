import React, { useState, useEffect } from 'react';
import { User, Activity, Sun, Moon, Radio, ShieldCheck, ChevronDown, LogOut, Settings } from 'lucide-react';
import { api, EXTENSION_CONNECTED_KEY } from '../api/api';

export default function Navbar({ title, theme, onToggleTheme, onNavigate, onLogout }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const user = api.getCurrentUser() || { user_id: 1, full_name: 'Krishna', email: 'test@tracex.com' };
    setCurrentUser(user);

    api.getTrackingStatus().then((res) => {
      if (res) {
        setIsPaused(!!res.is_paused);
        if (res.is_connected || localStorage.getItem(EXTENSION_CONNECTED_KEY) === 'true') {
          setIsExtensionConnected(true);
        }
      }
    }).catch(() => {});
  }, []);

  const firstName = currentUser?.full_name?.split(' ')[0] || 'Krishna';

  return (
    <header className="navbar d1-subpage-navbar">
      <div className="nav-title-group">
        <h1 className="nav-title">{title}</h1>
      </div>

      <div className="nav-user">
        {/* Extension Tracking Badge */}
        <div
          className={`tx-navbar-status-badge ${isPaused ? 'tx-badge-paused' : (isExtensionConnected ? 'tx-badge-active' : 'tx-badge-idle')}`}
          title={isPaused ? 'Tracking is paused' : (isExtensionConnected ? 'Extension connected & recording' : 'Waiting for extension')}
        >
          <span className="tx-status-dot" />
          <span>{isPaused ? 'Tracking Paused' : (isExtensionConnected ? 'Tracking Active' : 'Extension Idle')}</span>
        </div>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="tx-navbar-theme-btn"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}

        {/* User Pill & Menu */}
        <div className="d1-profile-wrapper">
          <div
            className="user-badge tx-cursor-pointer"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="d1-avatar-circle" style={{ width: '22px', height: '22px', fontSize: '11px' }}>
              {firstName.charAt(0).toUpperCase()}
            </div>
            <span>{firstName}</span>
            <ChevronDown size={13} />
          </div>

          {showDropdown && (
            <div className="d1-user-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="d1-dropdown-user-info">
                <strong>{currentUser?.full_name || 'Krishna'}</strong>
                <span>{currentUser?.email || 'test@tracex.com'}</span>
              </div>
              <div className="d1-dropdown-divider" />
              <button
                onClick={() => { setShowDropdown(false); onNavigate && onNavigate('/settings'); }}
                className="d1-dropdown-item"
              >
                <Settings size={14} />
                <span>Settings</span>
              </button>
              <button
                onClick={() => { setShowDropdown(false); onNavigate && onNavigate('/privacy'); }}
                className="d1-dropdown-item"
              >
                <ShieldCheck size={14} />
                <span>Privacy</span>
              </button>
              <div className="d1-dropdown-divider" />
              <button
                onClick={() => { setShowDropdown(false); onLogout && onLogout(); }}
                className="d1-dropdown-item d1-dropdown-danger"
              >
                <LogOut size={14} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
