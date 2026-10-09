import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, AlertCircle } from 'lucide-react';
import { api } from '../api/api';
import CourseCard from '../components/CourseCard';

export default function Courses({ onSelectCourse }) {
  const [courses, setCourses] = useState([]);
  const [courseProgressMap, setCourseProgressMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    try {
      setLoading(true);
      const [coursesData, progressData] = await Promise.all([
        api.getCourses(),
        api.getProgressAnalytics().catch(() => null),
      ]);

      setCourses(coursesData || []);

      const pMap = {};
      if (progressData?.course_progress) {
        progressData.course_progress.forEach((cp) => {
          pMap[cp.course_id] = cp.average_percent;
        });
      }
      setCourseProgressMap(pMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCourse(e) {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    try {
      setCreating(true);
      const created = await api.createCourse({
        course_name: newCourseName.trim(),
        description: newCourseDesc.trim() || undefined,
      });
      setCourses([created, ...courses]);
      setNewCourseName('');
      setNewCourseDesc('');
      setShowModal(false);
    } catch (err) {
      alert(`Error creating course: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="page-description">Organize your learning curriculums, topics, and deliberate study paths.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          <span>New Course</span>
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', padding: '12px 16px', borderRadius: '8px', color: '#fca5a5', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading courses...</p>
      ) : courses.length === 0 ? (
        <div className="card-section" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <BookOpen size={48} color="var(--text-dim)" style={{ marginBottom: '16px' }} />
          <h3>No Courses Found</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '20px' }}>
            Get started by creating your first course (e.g. DBMS, Operating Systems, Computer Networks).
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            <span>Create Course</span>
          </button>
        </div>
      ) : (
        <div className="course-grid">
          {courses.map((course) => (
            <CourseCard
              key={course.course_id}
              course={course}
              progress={courseProgressMap[course.course_id] || 0}
              onClick={() => onSelectCourse(course.course_id)}
            />
          ))}
        </div>
      )}

      {/* ── Create Course Modal ────────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '480px',
            padding: '28px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Create New Course</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Add a new course curriculum to track topics and study telemetry.
            </p>

            <form onSubmit={handleCreateCourse}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Course Name *</label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. DBMS, Data Structures, Operating Systems"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                required
                autoFocus
              />

              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Description</label>
              <textarea
                className="input-control"
                rows={3}
                placeholder="Brief summary of what this course covers..."
                value={newCourseDesc}
                onChange={(e) => setNewCourseDesc(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
