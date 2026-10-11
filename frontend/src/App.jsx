import React, { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Core TraceX Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ConnectExtension from './pages/ConnectExtension';
import Dashboard from './pages/Dashboard';
import Timeline from './pages/Timeline';
import Resources from './pages/Resources';
import Analytics from './pages/Analytics';
import DailySummary from './pages/DailySummary';
import Settings from './pages/Settings';
import BrowserHistory from './pages/BrowserHistory';
import Privacy from './pages/Privacy';
import ErrorBoundary from './components/ErrorBoundary';

// Preserved Study Tools
import Courses from './pages/Courses';
import CourseDetails from './pages/CourseDetails';
import StudySessions from './pages/StudySessions';

import { api, EXTENSION_CONNECTED_KEY, USER_KEY, TOKEN_KEY } from './api/api';

// ── Shell Layout for Authenticated Pages ─────────────────────────────────────
function AppLayout({ children, activeTab, theme, onToggleTheme, onLogout }) {
  const navigate = useNavigate();

  const pageTitles = {
    today:           'Today',
    timeline:        'Activity Timeline',
    history:         'History',
    resources:       'Web Resources',
    analytics:       'Activity Analytics',
    'daily-summary': 'Daily Summary',
    settings:        'Settings & System',
    privacy:         'Privacy & Telemetry',
    'connect-extension': 'Browser Extension',
    welcome:         'Welcome to TraceX',
    courses:         'Courses',
    'course-details':'Course Details',
    'study-sessions':'Study Sessions',
    notes:           'Notes & Summaries',
    goals:           'Goals & Milestones',
  };

  const handleSelectTab = (tabId) => {
    if (tabId === 'today') {
      navigate('/today');
    } else {
      navigate(`/${tabId}`);
    }
  };

  const isTodayPage = activeTab === 'today';

  return (
    <div className="d1-app-layout">
      {/* ── Left Sidebar (Dark, stylized logo, Habit card) ────────── */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      />

      {/* ── Main Content Area ─────────────────────────────────────── */}
      <main className="d1-main-content">
        {/* Only show top navbar for non-dashboard sub-pages */}
        {!isTodayPage && (
          <Navbar
            title={pageTitles[activeTab] || 'TraceX'}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onNavigate={(p) => navigate(p)}
            onLogout={onLogout}
          />
        )}

        {children}
      </main>
    </div>
  );
}

// ── Inner Router Component ───────────────────────────────────────────────────
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(() => api.getCurrentUser());
  const [theme, setTheme] = useState(() => localStorage.getItem('tracex_theme') || 'dark');
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tracex_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    try {
      window.postMessage({ type: 'TRACEX_WEB_LOGOUT' }, window.location.origin);
    } catch (e) {}
    api.logout();
    setCurrentUser(null);
    navigate('/login');
  };

  const handleSelectCourse = (courseId) => {
    if (courseId) {
      setSelectedCourseId(courseId);
      navigate(`/courses/${courseId}`);
    } else {
      setSelectedCourseId(null);
      navigate('/courses');
    }
  };

  const handleBackToCourses = () => {
    setSelectedCourseId(null);
    navigate('/courses');
  };

  // Determine current active tab for sidebar
  const currentPath = location.pathname.replace(/^\//, '') || 'today';
  let activeTab = currentPath.split('/')[0];
  if (activeTab === '' || activeTab === 'dashboard') activeTab = 'today';

  return (
    <Routes>
      {/* ── Public Landing Page ─────────────────────────────────────── */}
      <Route path="/" element={<Landing onNavigate={(p) => navigate(p)} />} />

      {/* ── Authentication Screens ─────────────────────────────────── */}
      <Route
        path="/login"
        element={
          <Login
            onNavigate={(p) => navigate(p)}
            onLoginSuccess={handleLoginSuccess}
          />
        }
      />
      <Route
        path="/signup"
        element={
          <SignUp
            onNavigate={(p) => navigate(p)}
            onLoginSuccess={handleLoginSuccess}
          />
        }
      />

      {/* ── Welcome / Extension Setup Onboarding ───────────────────── */}
      <Route
        path="/welcome"
        element={
          <ConnectExtension
            onNavigate={(p) => navigate(p)}
            user={currentUser}
          />
        }
      />
      <Route
        path="/connect-extension"
        element={
          <AppLayout
            activeTab="connect-extension"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <ConnectExtension
              onNavigate={(p) => navigate(p)}
              user={currentUser}
            />
          </AppLayout>
        }
      />

      {/* ── Standalone Privacy Page (also accessible in layout) ─────── */}
      <Route
        path="/privacy"
        element={
          <AppLayout
            activeTab="privacy"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <Privacy onNavigate={(p) => navigate(p)} />
          </AppLayout>
        }
      />

      {/* ── Main TraceX Dashboard (TODAY) ───────────────────────────── */}
      <Route
        path="/today"
        element={
          <AppLayout
            activeTab="today"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <ErrorBoundary>
              <Dashboard
                onNavigate={(p) => navigate(p)}
                onLogout={handleLogout}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            </ErrorBoundary>
          </AppLayout>
        }
      />

      {/* Legacy dashboard redirect */}
      <Route path="/dashboard" element={<Navigate to="/today" replace />} />

      {/* ── Browser History (MySQL-backed Chrome history page) ──────── */}
      <Route
        path="/history"
        element={
          <AppLayout
            activeTab="history"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <BrowserHistory />
          </AppLayout>
        }
      />

      {/* ── Activity Timeline ───────────────────────────────────────── */}
      <Route
        path="/timeline"
        element={
          <AppLayout
            activeTab="timeline"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <Timeline onNavigate={(p) => navigate(p)} />
          </AppLayout>
        }
      />

      {/* ── Web Resources ───────────────────────────────────────────── */}
      <Route
        path="/resources"
        element={
          <AppLayout
            activeTab="resources"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <Resources onNavigate={(p) => navigate(p)} />
          </AppLayout>
        }
      />

      {/* ── Activity Analytics ──────────────────────────────────────── */}
      <Route
        path="/analytics"
        element={
          <AppLayout
            activeTab="analytics"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <Analytics onNavigate={(p) => navigate(p)} />
          </AppLayout>
        }
      />

      {/* ── Daily Summary ───────────────────────────────────────────── */}
      <Route
        path="/daily-summary"
        element={
          <AppLayout
            activeTab="daily-summary"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <DailySummary onNavigate={(p) => navigate(p)} />
          </AppLayout>
        }
      />

      {/* ── Settings ────────────────────────────────────────────────── */}
      <Route
        path="/settings"
        element={
          <AppLayout
            activeTab="settings"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <Settings
              onNavigate={(p) => navigate(p)}
              onLogout={handleLogout}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </AppLayout>
        }
      />

      {/* ── Preserved Study Tools ───────────────────────────────────── */}
      <Route
        path="/courses"
        element={
          <AppLayout
            activeTab="courses"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <Courses onSelectCourse={handleSelectCourse} />
          </AppLayout>
        }
      />

      <Route
        path="/courses/:courseId"
        element={
          <AppLayout
            activeTab="courses"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <CourseDetails
              courseId={selectedCourseId}
              onBack={handleBackToCourses}
            />
          </AppLayout>
        }
      />

      <Route
        path="/study-sessions"
        element={
          <AppLayout
            activeTab="study-sessions"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <StudySessions />
          </AppLayout>
        }
      />

      <Route
        path="/notes"
        element={
          <AppLayout
            activeTab="notes"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <Resources onNavigate={(p) => navigate(p)} />
          </AppLayout>
        }
      />

      <Route
        path="/goals"
        element={
          <AppLayout
            activeTab="goals"
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          >
            <DailySummary onNavigate={(p) => navigate(p)} />
          </AppLayout>
        }
      />

      {/* Fallback to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
