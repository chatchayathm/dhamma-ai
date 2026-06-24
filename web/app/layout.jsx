import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Dhamma AI — ผู้ช่วยศึกษาพระไตรปิฎก',
  description: 'ถาม-ตอบพระธรรมจากพระไตรปิฎกภาษาไทย ฉบับสยามรัฐ 45 เล่ม พร้อมอ้างอิงแหล่งที่มาทุกคำตอบ',
};

// viewport-fit=cover → use the full screen incl. notch/home-indicator (iOS).
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app-shell">
          <header className="site-header">
            <div className="inner">
              <Link href="/" className="brand">
                <span className="lotus">🪷</span> Dhamma AI
              </Link>
              <nav style={{ display: 'flex', gap: 4 }}>
                <Link href="/" className="nav-link">สนทนาธรรม</Link>
                <Link href="/browse" className="nav-link">เรียกดูพระไตรปิฎก</Link>
              </nav>
            </div>
          </header>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
