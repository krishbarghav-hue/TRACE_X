import React, { useState } from 'react';
import { PieChart, Info } from 'lucide-react';

const CATEGORY_COLORS = {
  Development: '#6366f1',
  Research: '#0ea5e9',
  Learning: '#10b981',
  Entertainment: '#f59e0b',
  'AI Assistance': '#8b5cf6',
  'Browser Activity': '#06b6d4',
  Other: '#64748b',
};

function inferCategory(domain = '') {
  const d = domain.toLowerCase();
  if (d.includes('github') || d.includes('gitlab') || d.includes('localhost') || d.includes('stackoverflow') || d.includes('npm') || d.includes('dev')) {
    return 'Development';
  }
  if (d.includes('wikipedia') || d.includes('arxiv') || d.includes('scholar') || d.includes('medium') || d.includes('docs.') || d.includes('notion')) {
    return 'Research';
  }
  if (d.includes('leetcode') || d.includes('coursera') || d.includes('edx') || d.includes('udemy') || d.includes('geeksforgeeks') || d.includes('khanacademy')) {
    return 'Learning';
  }
  if (d.includes('youtube') || d.includes('netflix') || d.includes('spotify') || d.includes('twitch') || d.includes('reddit')) {
    return 'Entertainment';
  }
  if (d.includes('chatgpt') || d.includes('openai') || d.includes('claude') || d.includes('gemini') || d.includes('anthropic')) {
    return 'AI Assistance';
  }
  return 'Browser Activity';
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function TimeDistributionCard({
  topDomains = [],
  totalSeconds = 0,
  loading = false,
}) {
  const [hoveredCategory, setHoveredCategory] = useState(null);

  // Group observed domains into categories
  const categoryMap = {};
  topDomains.forEach((item) => {
    const cat = inferCategory(item.domain);
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        name: cat,
        seconds: 0,
        domains: [],
        color: CATEGORY_COLORS[cat] || '#64748b',
      };
    }
    categoryMap[cat].seconds += item.total_seconds || 0;
    categoryMap[cat].domains.push(item.domain);
  });

  const categories = Object.values(categoryMap).sort((a, b) => b.seconds - a.seconds);
  const effectiveTotal = categories.reduce((sum, c) => sum + c.seconds, 0) || totalSeconds || 1;

  // Donut geometry constants
  const size = 220;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = -90; // start at top 12 o'clock

  const segments = categories.map((cat) => {
    const fraction = cat.seconds / effectiveTotal;
    const dashLength = fraction * circumference;
    const dashOffset = circumference - dashLength;
    const rotation = currentAngle;
    currentAngle += fraction * 360;

    return {
      ...cat,
      fraction,
      percentage: Math.round(fraction * 100),
      dashLength,
      dashOffset,
      rotation,
    };
  });

  return (
    <div className="tx-glass-card tx-distribution-card">
      <div className="tx-card-header">
        <div className="tx-card-title-group">
          <div className="tx-icon-accent-box">
            <PieChart size={16} />
          </div>
          <div>
            <h3 className="tx-card-title">Time Distribution</h3>
            <span className="tx-card-subtitle">
              Derived from observed domain activity
            </span>
          </div>
        </div>

        <div className="tx-inferred-badge" title="Derived algorithmically from domain classification. Does not measure mental state.">
          <Info size={12} />
          <span>Inferred</span>
        </div>
      </div>

      <div className="tx-distribution-content">
        {/* SVG Donut Visualizer */}
        <div className="tx-donut-container">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="tx-donut-svg">
            {/* Background track circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
            />

            {/* Segments */}
            {categories.length > 0 &&
              segments.map((seg) => (
                <circle
                  key={seg.name}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={hoveredCategory === seg.name ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${seg.dashLength} ${circumference}`}
                  strokeDashoffset={0}
                  transform={`rotate(${seg.rotation} ${size / 2} ${size / 2})`}
                  style={{
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    opacity: hoveredCategory && hoveredCategory !== seg.name ? 0.4 : 1,
                  }}
                  onMouseEnter={() => setHoveredCategory(seg.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                />
              ))}
          </svg>

          {/* Center text display */}
          <div className="tx-donut-center-label">
            <span className="tx-donut-center-sub">Today's Active Time</span>
            <span className="tx-donut-center-value">
              {totalSeconds > 0 ? formatDuration(totalSeconds) : '0m'}
            </span>
            <span className="tx-donut-center-status">
              {categories.length > 0 ? `${categories.length} categories` : 'No data yet'}
            </span>
          </div>
        </div>

        {/* Legend & Breakdown */}
        <div className="tx-distribution-legend">
          {categories.length === 0 ? (
            <div className="tx-legend-empty">
              <p>No activity categorized today.</p>
              <span className="tx-legend-empty-hint">
                Activity from supported domains will display categorized distributions here.
              </span>
            </div>
          ) : (
            <div className="tx-legend-list">
              {categories.map((cat) => {
                const pct = Math.round((cat.seconds / effectiveTotal) * 100);
                const isHovered = hoveredCategory === cat.name;
                return (
                  <div
                    key={cat.name}
                    className={`tx-legend-row ${isHovered ? 'tx-legend-row-hovered' : ''}`}
                    onMouseEnter={() => setHoveredCategory(cat.name)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <div className="tx-legend-swatch" style={{ background: cat.color }} />
                    <div className="tx-legend-info">
                      <div className="tx-legend-name">{cat.name}</div>
                      <div className="tx-legend-domains-preview">
                        {cat.domains.slice(0, 2).join(', ')}
                      </div>
                    </div>
                    <div className="tx-legend-metrics">
                      <span className="tx-legend-time">{formatDuration(cat.seconds)}</span>
                      <span className="tx-legend-pct">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
