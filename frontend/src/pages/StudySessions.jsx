import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, BookOpen, CheckCircle, History } from 'lucide-react';
import { api } from '../api/api';
import StatCard from '../components/StatCard';

export default function StudySessions() {
  const [courses, setCourses] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [studyMode, setStudyMode] = useState('reading');
  const [sessionNotes, setSessionNotes] = useState('');

  // Active session tracking state
  const [activeSession, setActiveSession] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // History and analytics
  const [sessions, setSessions] = useState([]);
  const [totalStudyMinutes, setTotalStudyMinutes] = useState(0);
  const [lastSession, setLastSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionsData();
  }, []);

  // Timer interval for active session
  useEffect(() => {
    let timer = null;
    if (activeSession) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [activeSession]);

  async function loadSessionsData() {
    try {
      setLoading(true);
      const [coursesData, sessionsData] = await Promise.all([
        api.getCourses(),
        api.getStudySessions(),
      ]);

      setCourses(coursesData || []);
      if (coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].course_id);
        loadTopics(coursesData[0].course_id);
      }

      setSessions(sessionsData || []);
      if (sessionsData && sessionsData.length > 0) {
        setLastSession(sessionsData[0]);
        const total = sessionsData.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
        setTotalStudyMinutes(total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTopics(courseId) {
    if (!courseId) return;
    try {
      const tData = await api.getTopicsByCourse(courseId);
      setTopics(tData || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCourseChange(e) {
    const id = e.target.value;
    setSelectedCourseId(id);
    setSelectedTopicId('');
    await loadTopics(id);
  }

  async function handleStartStudy() {
    if (!selectedCourseId) {
      alert('Please select a course to begin studying.');
      return;
    }

    try {
      const started = await api.startStudySession({
        course_id: parseInt(selectedCourseId),
        topic_id: selectedTopicId ? parseInt(selectedTopicId) : null,
        study_mode: studyMode,
        session_notes: sessionNotes || undefined,
      });

      setActiveSession(started);
      setElapsedSeconds(0);
    } catch (err) {
      alert(`Error starting session: ${err.message}`);
    }
  }

  async function handleStopStudy() {
    if (!activeSession) return;

    try {
      const ended = await api.endStudySession(activeSession.session_id, {
        session_notes: sessionNotes || undefined,
      });

      setActiveSession(null);
      setLastSession(ended);
      setSessionNotes('');
      // Reload history
      const updatedSessions = await api.getStudySessions();
      setSessions(updatedSessions || []);
      const total = (updatedSessions || []).reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
      setTotalStudyMinutes(total);
    } catch (err) {
      alert(`Error stopping session: ${err.message}`);
    }
  }

  function formatTimer(totalSecs) {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deliberate Study Sessions</h1>
          <p className="page-description">Start focused deep-work blocks. Track verified study time separate from browser activity.</p>
        </div>
      </div>

      {/* ── Key Metrics ────────────────────────────────────────────────────── */}
      <div className="stats-grid">
        <StatCard
          label="Total Study Time"
          value={`${totalStudyMinutes}m`}
          subtext={`${Math.round(totalStudyMinutes / 60 * 10) / 10} hours deliberate focus`}
          icon={Clock}
          color="var(--primary)"
        />
        <StatCard
          label="Total Sessions"
          value={sessions.length}
          icon={CheckCircle}
          color="var(--sky)"
        />
        <StatCard
          label="Last Session"
          value={lastSession ? `${lastSession.duration_minutes}m` : 'None'}
          subtext={lastSession ? `${lastSession.study_mode} mode` : 'No sessions recorded yet'}
          icon={History}
          color="var(--success)"
        />
      </div>

      {/* ── Active Study Timer Banner ──────────────────────────────────────── */}
      {activeSession ? (
        <div className="timer-banner">
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--sky)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ● STUDY SESSION IN PROGRESS
            </span>
            <div className="timer-digits">{formatTimer(elapsedSeconds)}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Mode: <strong>{activeSession.study_mode}</strong> • Course #{activeSession.course_id}
            </p>
          </div>

          <button className="btn btn-danger" style={{ padding: '14px 28px', fontSize: '15px' }} onClick={handleStopStudy}>
            <Square size={18} />
            <span>STOP STUDY</span>
          </button>
        </div>
      ) : (
        <div className="card-section">
          <div className="section-head">
            <div className="section-title">
              <Play size={18} color="var(--primary)" />
              <span>Launch a New Study Session</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Course *</label>
              <select className="input-control" value={selectedCourseId} onChange={handleCourseChange} required>
                {courses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Topic (Optional)</label>
              <select className="input-control" value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)}>
                <option value="">None (General Course Study)</option>
                {topics.map((t) => (
                  <option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Study Mode</label>
              <select className="input-control" value={studyMode} onChange={(e) => setStudyMode(e.target.value)}>
                <option value="reading">Reading</option>
                <option value="video">Video Watching</option>
                <option value="practice">Hands-On Practice / Coding</option>
                <option value="revision">Exam Revision</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Session Goal / Notes</label>
            <input
              type="text"
              className="input-control"
              placeholder="e.g. Completing exercises for Joins and Group By..."
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
            />
          </div>

          <button className="btn btn-success" style={{ padding: '12px 24px', fontSize: '15px' }} onClick={handleStartStudy}>
            <Play size={18} />
            <span>START STUDY</span>
          </button>
        </div>
      )}

      {/* ── Completed Study Sessions History ────────────────────────────────── */}
      <div className="card-section" style={{ marginTop: '28px' }}>
        <div className="section-head">
          <div className="section-title">
            <History size={18} color="var(--primary)" />
            <span>Completed Study Sessions History ({sessions.length})</span>
          </div>
        </div>

        {sessions.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>No completed study sessions yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessions.map((s) => (
              <div key={s.session_id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                      {s.study_mode}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      {courses.find((c) => c.course_id === s.course_id)?.course_name || `Course #${s.course_id}`}
                    </span>

                  </div>
                  {s.session_notes && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.session_notes}</p>}
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {new Date(s.start_time).toLocaleString()}
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>
                    {s.duration_minutes || 0}m
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Duration</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
