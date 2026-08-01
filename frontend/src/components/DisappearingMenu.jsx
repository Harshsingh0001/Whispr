import { useState } from 'react';

// A practical subset of common timer options - covers the short, medium,
// and long durations someone would realistically want, without listing
// every possible increment.
const OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '30 seconds', seconds: 30 },
  { label: '1 minute', seconds: 60 },
  { label: '5 minutes', seconds: 300 },
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
];

export default function DisappearingMenu({ currentDuration, onChange }) {
  const [open, setOpen] = useState(false);

  const currentLabel = OPTIONS.find((o) => o.seconds === currentDuration)?.label || 'Custom';

  return (
    <div className="disappearing-menu">
      <button className="disappearing-toggle" onClick={() => setOpen((prev) => !prev)} title="Disappearing messages">
        {currentDuration > 0 ? '⏳' : '⏳'}
      </button>
      {open && (
        <div className="disappearing-dropdown">
          <div className="disappearing-dropdown-title">Disappearing messages</div>
          {OPTIONS.map((opt) => (
            <div
              key={opt.seconds}
              className={`disappearing-option ${opt.seconds === currentDuration ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.seconds);
                setOpen(false);
              }}
            >
              {opt.label} {opt.seconds === currentDuration && '✓'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
