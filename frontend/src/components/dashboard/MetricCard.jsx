import React from 'react';

export default function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  accent = '#6366f1',
  trend,
  trendPositive = true,
  loading = false,
}) {
  return (
    <div className="tx-glass-card tx-metric-glass-card" style={{ '--card-accent': accent }}>
      <div className="tx-metric-top">
        <span className="tx-metric-tag">{label}</span>
        <div
          className="tx-metric-icon-wrap"
          style={{
            background: `${accent}18`,
            color: accent,
            boxShadow: `0 0 16px ${accent}25`,
          }}
        >
          {Icon && <Icon size={18} strokeWidth={2.2} />}
        </div>
      </div>

      <div className="tx-metric-value-wrap">
        {loading ? (
          <div className="tx-skeleton-bar" style={{ width: '60%', height: '36px' }} />
        ) : (
          <div className="tx-metric-main-value">{value}</div>
        )}
      </div>

      <div className="tx-metric-bottom">
        {trend && (
          <span
            className={`tx-metric-trend-pill ${
              trendPositive ? 'tx-trend-up' : 'tx-trend-down'
            }`}
          >
            {trend}
          </span>
        )}
        <span className="tx-metric-subtext-msg">{subtext}</span>
      </div>

      {/* Subtle bottom gradient glow */}
      <div
        className="tx-metric-glow"
        style={{
          background: `radial-gradient(ellipse at bottom, ${accent}20 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
