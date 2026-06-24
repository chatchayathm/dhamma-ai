'use client';

import { useState } from 'react';
import Link from 'next/link';

// Logo (left) + hamburger menu (right). Replaces the two separate nav links.
export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="inner">
      <Link href="/" className="brand">
        <span className="lotus">🪷</span> Dhamma AI
        <span className="nav-free-tag">ใช้งานฟรี</span>
      </Link>

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
  );
}
