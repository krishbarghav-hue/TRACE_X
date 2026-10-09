import React from 'react';

export default function StatCard({ label, value, subtext, icon: Icon, color = 'var(--primary)' }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <div className="stat-icon" style={{ backgroundColor: `${color}20`, color: color }}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {subtext && <div className="stat-sub">{subtext}</div>}
    </div>
  );
}
