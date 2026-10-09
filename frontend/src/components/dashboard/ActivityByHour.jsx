import React, { useState } from 'react';
import { BarChart2, Clock } from 'lucide-react';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function ActivityByHour({ hourly = [], loading = false }) {
  const [hoveredHour, setHoveredHour] = useState(null);

  // If hourly is 24 hours, show work/active hours 6am - 11pm (hours 6 to 23)
  const displayHours = hourly.length === 24 ? hourly.slice(6, 24) : hourly;
  const maxMinutes = Math.max(...displayHours.map((h) => h.total_minutes || 0), 1);
  const currentHour = new Date().getHours();

  return (
    <div className="tx-glass-card tx-hourly-card">
      <div className="tx-card-header">
        <div className="tx-card-title-group">
          <div className="tx-icon-accent-box tx-accent-blue">
            <BarChart2 size={16} />
          </div>
          <div>
            <h3 className="tx-card-title">Activity by Hour</h3>
            <span className="tx-card-subtitle">
              Observed telemetry intensity throughout the day
            </span>
          </div>
        </div>

        {hoveredHour ? (
          <div className="tx-hourly-tooltip-pill">
            <span className="tx-tooltip-hour">{hoveredHour.label}:</span>{' '}
            <span className="tx-tooltip-dur">{formatDuration(hoveredHour.total_seconds)}</span>
            <span className="tx-tooltip-events">({hoveredHour.activities} events)</span>
          </div>
        ) : (
          <div className="tx-hourly-legend-pill">
            <span className="tx-now-indicator-sample" /> Current Hour: {currentHour % 12 || 12} {currentHour >= 12 ? 'PM' : 'AM'}
          </div>
        )}
      </div>

      <div className="tx-hourly-chart-body">
        {loading ? (
          <div className="tx-hourly-skeleton">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="tx-skeleton-bar-vert" />
            ))}
          </div>
        ) : (
          <div className="tx-hourly-bars-container">
            {displayHours.map((item) => {
              const minutes = item.total_minutes || 0;
              const heightPct = Math.max(6, Math.min(100, (minutes / maxMinutes) * 100));
              const isCurrent = item.hour === currentHour;
              const hasActivity = minutes > 0;

              return (
                <div
                  key={item.hour}
                  className={`tx-hourly-bar-col ${isCurrent ? 'tx-bar-is-current' : ''}`}
                  onMouseEnter={() => setHoveredHour(item)}
                  onMouseLeave={() => setHoveredHour(null)}
                >
                  <div className="tx-hourly-bar-track">
                    <div
                      className={`tx-hourly-bar-fill ${hasActivity ? 'tx-bar-active' : ''}`}
                      style={{
                        height: `${heightPct}%`,
                        background: isCurrent
                          ? 'linear-gradient(180deg, #38bdf8, #0ea5e9)'
                          : hasActivity
                          ? 'linear-gradient(180deg, #818cf8, #4f46e5)'
                          : 'rgba(255, 255, 255, 0.05)',
                      }}
                    />
                  </div>

                  <span className="tx-hourly-label">
                    {item.hour % 2 === 0 ? item.label : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
