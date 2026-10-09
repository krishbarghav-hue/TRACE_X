import React, { useState } from 'react';
import { LogIn, ArrowRight, ShieldCheck, Mail, Lock, AlertCircle, Sparkles } from 'lucide-react';
import { api, EXTENSION_CONNECTED_KEY } from '../api/api';

export default function Login({ onNavigate, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.login({ email, password });
      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }

      // Check whether extension is connected
      const isExtensionConnected = localStorage.getItem(EXTENSION_CONNECTED_KEY) === 'true';
      if (isExtensionConnected) {
        onNavigate('/today');
      } else {
        onNavigate('/welcome');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setEmail('test@tracex.com');
    setPassword('tracex123');
    setError('');
    setLoading(true);

    try {
      const data = await api.login({ email: 'test@tracex.com', password: 'tracex123' });
      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
      const isExtensionConnected = localStorage.getItem(EXTENSION_CONNECTED_KEY) === 'true';
      if (isExtensionConnected) {
        onNavigate('/today');
      } else {
        onNavigate('/welcome');
      }
    } catch (err) {
      setError(err.message || 'Quick demo login failed.');
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
          {/* Logo & Header */}
          <div className="tx-auth-header">
            <div className="tx-logo-icon tx-logo-center" onClick={() => onNavigate('/')}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4C9 1 3 3 2 9C1 15 7 19 12 21C17 19 23 15 22 9C21 3 15 1 12 4Z"
                  fill="url(#auth-logo-grad)"
                />
                <path
                  d="M12 6C10 3 6 4 5 8C4 12 8 16 12 18C16 16 20 12 19 8C18 4 14 3 12 6Z"
                  fill="#070b14"
                  opacity="0.35"
                />
                <defs>
                  <linearGradient id="auth-logo-grad" x1="2" y1="2" x2="22" y2="22">
                    <stop stopColor="#a855f7" />
                    <stop offset="0.5" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2 className="tx-auth-title">Welcome back to TraceX</h2>
            <p className="tx-auth-subtitle">Sign in to access your private digital activity timeline</p>
          </div>

          {error && (
            <div className="tx-auth-alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="tx-auth-form">
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
                  placeholder="••••••••"
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
                <span>Signing in...</span>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo One-Click Access */}
          <div className="tx-demo-login-box">
            <div className="tx-demo-divider">
              <span>OR INSTANT LOCAL DEV ACCESS</span>
            </div>
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              disabled={loading}
              className="tx-btn-secondary tx-btn-full"
            >
              <Sparkles size={15} color="#38bdf8" />
              <span>One-Click Login as Krishna (test@tracex.com)</span>
            </button>
          </div>

          <div className="tx-auth-footer">
            <span>Don't have an account?</span>
            <button
              onClick={() => onNavigate('/signup')}
              className="tx-link-btn"
            >
              Create Account →
            </button>
          </div>

          <div className="tx-auth-privacy-guarantee">
            <ShieldCheck size={14} color="#10b981" />
            <span>100% Private local database storage</span>
          </div>
        </div>
      </div>
    </div>
  );
}
