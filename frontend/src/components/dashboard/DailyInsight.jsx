import React from 'react';
import { Compass, Sparkles, ExternalLink, Globe } from 'lucide-react';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function getFavicon(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export default function DailyInsight({
  topDomains = [],
  totalSeconds = 0,
  loading = false,
}) {
  const hasData = topDomains && topDomains.length > 0;
  const maxSeconds = hasData ? Math.max(...topDomains.map((d) => d.total_seconds || 0), 1) : 1;

  return (
    <div className="tx-glass-card tx-daily-insight-card">
      <div className="tx-card-header">
        <div className="tx-card-title-group">
          <div className="tx-icon-accent-box tx-accent-purple">
            <Compass size={16} />
          </div>
          <div>
            <h3 className="tx-card-title">What You Did Today</h3>
            <span className="tx-card-subtitle">
              Most accessed work areas and digital footprint
            </span>
          </div>
        </div>

        <span className="tx-observed-badge">
          Observed Telemetry
        </span>
      </div>

      <div className="tx-daily-insight-body">
        {loading ? (
          <div className="tx-loading-stack">
            {[1, 2, 3].map((i) => (
              <div key={i} className="tx-skeleton-row" />
            ))}
          </div>
        ) : !hasData ? (
          <div className="tx-insight-empty">
            <Compass size={28} className="tx-insight-empty-icon" />
            <p>No activity tracked yet today</p>
            <span>
              As you browse docs, repositories, research, and tools, your primary focus areas will be summarized here.
            </span>
          </div>
        ) : (
          <div className="tx-insight-list">
            {topDomains.slice(0, 5).map((item, idx) => {
              const seconds = item.total_seconds || 0;
              const pct = Math.round((seconds / (totalSeconds || 1)) * 100);
              const barWidth = Math.max(5, (seconds / maxSeconds) * 100);

              return (
                <div key={item.domain} className="tx-insight-row">
                  <div className="tx-insight-meta">
                    <div className="tx-insight-domain-col">
                      <img
                        src={getFavicon(item.domain)}
                        alt=""
                        className="tx-insight-favicon"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <span className="tx-insight-name">{item.domain}</span>
                    </div>

                    <div className="tx-insight-stats-col">
                      <span className="tx-insight-time">{formatDuration(seconds)}</span>
                      <span className="tx-insight-pct">{pct}% of day</span>
                    </div>
                  </div>

                  <div className="tx-insight-bar-track">
                    <div
                      className="tx-insight-bar-fill"
                      style={{
                        width: `${barWidth}%`,
                        background:
                          idx === 0
                            ? 'linear-gradient(90deg, #6366f1, #a855f7)'
                            : idx === 1
                            ? 'linear-gradient(90deg, #0ea5e9, #38bdf8)'
                            : idx === 2
                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                            : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
