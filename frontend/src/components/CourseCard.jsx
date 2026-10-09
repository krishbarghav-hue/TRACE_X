import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import ProgressBar from './ProgressBar';

export default function CourseCard({ course, onClick, progress = 0 }) {
  return (
    <div className="course-card" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(14, 165, 233, 0.2))',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <BookOpen size={18} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            COURSE #{course.course_id}
          </span>
        </div>
        <ChevronRight size={18} color="#94a3b8" />
      </div>

      <h3 className="course-title">{course.course_name}</h3>
      <p className="course-desc">{course.description || 'No description provided.'}</p>

      <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <ProgressBar percent={progress} />
      </div>
    </div>
  );
}
