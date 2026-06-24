'use client';

import { useState } from 'react';
import Link from 'next/link';

// Logo (left) + refresh & hamburger (right).
export function Navbar() {
  const [open, setOpen] = useState(false);

  function handleRefresh() {
    if (confirm('เริ่มการสนทนาใหม่?')) {
      window.location.reload();
    }
  }

  return (
    <div className="inner">
      <Link href="/" className="brand">
        <span className="lotus">🪷</span> Dhamma AI
      </Link>

      <div className="nav-right">
        <button
          className="nav-icon-btn"
          onClick={handleRefresh}
          aria-label="เริ่มใหม่"
          title="เริ่มการสนทนาใหม่"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M15 9A6 6 0 1 1 9 3h3M12 1l2 2-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="nav-menu-wrapper">
          <button
            className="hamburger-btn"
            onClick={() => setOpen(!open)}
            aria-label="เมนู"
            aria-expanded={open}
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {open && (
            <>
              <div className="menu-backdrop" onClick={() => setOpen(false)} />
              <div className="dropdown-menu">
                <Link href="/" className="dropdown-item" onClick={() => setOpen(false)}>สนทนาธรรม</Link>
                <Link href="/browse" className="dropdown-item" onClick={() => setOpen(false)}>เรียกดูพระไตรปิฎก</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
