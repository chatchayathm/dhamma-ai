'use client';

import { useState } from 'react';
import { DanaPanel } from './DanaPanel';

// Reusable, non-intrusive "สนับสนุนการเผยแผ่ธรรมะ" trigger. Appears only where
// explicitly placed (footer / after positive feedback / transparency page).
// Never auto-opens — only toggles on click.
export function DanaButton({ context = 'footer' }) {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className="dana-wrapper">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`dana-trigger ${context}`}
        type="button"
      >
        สนับสนุนการเผยแผ่ธรรมะ
      </button>

      {showPanel && <DanaPanel onClose={() => setShowPanel(false)} />}
    </div>
  );
}
