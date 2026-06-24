import './globals.css';
import { Navbar } from '../components/Navbar';

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
            <Navbar />
          </header>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
