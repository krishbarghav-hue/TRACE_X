import React, { useState } from 'react';
import { UserPlus, ArrowRight, ShieldCheck, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { api, EXTENSION_CONNECTED_KEY } from '../api/api';

export default function SignUp({ onNavigate, onLoginSuccess }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const data = await api.register({
        full_name: fullName,
        email,
        password,
      });

      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }

      // New users must connect the Chrome extension first
      onNavigate('/connect-extension');
    } catch (err) {
      setError(err.message || 'Registration failed. An account with this email may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tx-auth-page">
      <div className="tx-auth-bg">
        <img
          src="/mountain_hero_panorama.jpg"
          alt="Twilight Panorama"
          className="tx-auth-bg-img"
        />
        <div className="tx-auth-bg-overlay" />
      </div>

      <div className="tx-auth-container">
        <div className="tx-auth-card">
          <div className="tx-auth-header">
            <div className="tx-logo-icon tx-logo-center" onClick={() => onNavigate('/')}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4C9 1 3 3 2 9C1 15 7 19 12 21C17 19 23 15 22 9C21 3 15 1 12 4Z"
                  fill="url(#signup-logo-grad)"
                />
                <path
                  d="M12 6C10 3 6 4 5 8C4 12 8 16 12 18C16 16 20 12 19 8C18 4 14 3 12 6Z"
                  fill="#070b14"
                  opacity="0.35"
                />
                <defs>
                  <linearGradient id="signup-logo-grad" x1="2" y1="2" x2="22" y2="22">
                    <stop stopColor="#a855f7" />
                    <stop offset="0.5" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2 className="tx-auth-title">Create your TraceX Account</h2>
            <p className="tx-auth-subtitle">Begin recording your private digital day with intelligence</p>
          </div>

          {error && (
            <div className="tx-auth-alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="tx-auth-form">
            <div className="tx-form-group">
              <label className="tx-label">Full Name</label>
              <div className="tx-input-wrap">
                <User size={16} className="tx-input-icon" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Krishna Sharma"
                  required
                  className="tx-input"
                />
              </div>
            </div>

            <div className="tx-form-group">
              <label className="tx-label">Email Address</label>
              <div className="tx-input-wrap">
                <Mail size={16} className="tx-input-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="krishna@example.com"
                  required
                  className="tx-input"
                />
              </div>
            </div>

            <div className="tx-form-group">
              <label className="tx-label">Password</label>
              <div className="tx-input-wrap">
                <Lock size={16} className="tx-input-icon" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="tx-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="tx-btn-primary tx-btn-full tx-btn-glow"
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Account & Continue</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="tx-auth-footer">
            <span>Already have an account?</span>
            <button
              onClick={() => onNavigate('/login')}
              className="tx-link-btn"
            >
              Sign In Instead →
            </button>
          </div>

          <div className="tx-auth-privacy-guarantee">
            <ShieldCheck size={14} color="#10b981" />
            <span>Passwords are hashed with bcrypt. 100% private.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
