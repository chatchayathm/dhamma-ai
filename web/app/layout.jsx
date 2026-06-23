import './globals.css';
import Link from 'next/link';
import { DanaButton } from '@/components/DanaButton';

export const metadata = {
  title: 'Dhamma AI — ผู้ช่วยศึกษาพระไตรปิฎก',
  description: 'ถาม-ตอบพระธรรมจากพระไตรปิฎกภาษาไทย ฉบับสยามรัฐ 45 เล่ม พร้อมอ้างอิงแหล่งที่มาทุกคำตอบ',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
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
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="footer-inner">
            <span className="footer-free">🪷 Dhamma AI ให้บริการฟรี</span>
            <DanaButton context="footer" />
            <Link href="/about/dana" className="footer-link">ความโปร่งใสด้านการเงิน</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
