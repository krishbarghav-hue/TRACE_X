import React from 'react';

export default function ProgressBar({ percent = 0, showLabel = true }) {
  const cleanPercent = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>Completion</span>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{cleanPercent}%</span>
        </div>
      )}
      <div className="progress-container">
        <div className="progress-fill" style={{ width: `${cleanPercent}%` }} />
      </div>
    </div>
  );
}
