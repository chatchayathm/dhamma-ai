'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { askQuestion } from '../lib/api';
import { FeedbackWidget } from '../components/FeedbackWidget';
import { DanaButton } from '../components/DanaButton';

const CONF_LABEL = {
  high: { th: 'ความมั่นใจสูง', cls: 'high' },
  medium: { th: 'ความมั่นใจปานกลาง', cls: 'medium' },
  low: { th: 'ความมั่นใจต่ำ — ควรตรวจสอบกับผู้รู้', cls: 'low' },
  not_found: { th: 'ไม่พบแหล่งอ้างอิง', cls: 'not_found' },
};

const TONES = [
  { id: 'general', icon: '🌿', label: 'คนทั่วไป', description: 'ภาษาธรรมดา เข้าใจง่าย ไม่ต้องรู้ธรรมะมาก่อน' },
  { id: 'dhamma', icon: '🪷', label: 'สายธรรมะ', description: 'ภาษาธรรมะ อ้างอิงพระสูตร เหมาะกับผู้ปฏิบัติ' },
];

function Citation({ c }) {
  return (
    <div className="cite-item">
      <span className="cite-vol">เล่มที่ {c.volume}</span> {c.pitaka}
      {c.nikaya ? ` — ${c.nikaya}` : ''} — {c.sutta_name}
      {c.sutta_number ? ` ข้อ ${c.sutta_number}` : ''}
    </div>
  );
}

function AiMessage({ m }) {
  const conf = CONF_LABEL[m.confidence] || CONF_LABEL.not_found;

  return (
    <div className="msg ai">
      <div className="bubble">
        <div className="answer-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.answer}</ReactMarkdown>
        </div>

        {m.dhamma_angle && (
          <div className="dhamma-angle-tag">🌿 มุมธรรมะ: {m.dhamma_angle}</div>
        )}

        {m.category === 'science_nature' && (
          <p className="science-note">
            คำตอบด้านวิทยาศาสตร์อิงข้อมูลทั่วไปค่ะ มุมธรรมะเป็นการชวนมองเพิ่มเติม ไม่ใช่การอธิบายแทนกันค่ะ 🙏
          </p>
        )}

        <div className="meta-row">
          <span className={`badge ${conf.cls}`}>{conf.th}</span>
          {m.retrieved_chunks > 0 && <span className="meta-dim">ใช้ข้อมูล {m.retrieved_chunks} ส่วน</span>}
        </div>

        {m.citations?.length > 0 && (
          <details className="card" open>
            <summary>📚 อ้างอิง ({m.citations.length})</summary>
            <div className="card-body">
              {m.citations.map((c, i) => <Citation key={i} c={c} />)}
            </div>
          </details>
        )}

        {m.sources?.length > 0 && (
          <details className="card">
            <summary>🔍 ข้อความต้นฉบับจากพระไตรปิฎก (เพื่อตรวจสอบเอง)</summary>
            <div className="card-body">
              {m.sources.map((s, i) => (
                <div className="source-item" key={i}>
                  <div className="source-head">
                    เล่มที่ {s.volume} — {s.sutta_name}
                    {s.sutta_number ? ` ข้อ ${s.sutta_number}` : ''} · ความใกล้เคียง {s.score.toFixed(3)}
                  </div>
                  <div className="source-text">{s.text}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        <FeedbackWidget question={m.question} answer={m.answer} />
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tone, setTone] = useState('general');
  const [footerOpen, setFooterOpen] = useState(false);
  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-resize the textarea up to ~4 lines, then scroll internally.
  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
  }

  // iOS Safari: when the keyboard opens, keep the latest message in view.
  function onFocusInput() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end' }), 300);
  }

  // Restore saved tone preference (client-only to avoid SSR mismatch).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dhamma_tone');
      if (saved && ['general', 'dhamma'].includes(saved)) setTone(saved);
    } catch {}
  }, []);

  function chooseTone(t) {
    setTone(t);
    try {
      localStorage.setItem('dhamma_tone', t);
    } catch {}
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function submit(text) {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setError('');
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const res = await askQuestion(question, { tone });
      setMessages((m) => [...m, { role: 'ai', question, ...res }]);
    } catch (e) {
      setError(`เกิดข้อผิดพลาด: ${e.message} (ตรวจสอบว่า API ที่ ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'} รันอยู่)`);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-scroll" ref={scrollRef}>
        <div className="container chat-wrap">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div className="msg user" key={i}><div className="bubble">{m.text}</div></div>
            ) : (
              <AiMessage m={m} key={i} />
            ),
          )}

          {loading && (
            <div className="msg ai">
              <div className="bubble">
                <span className="dots">กำลังค้นพระไตรปิฎก<span>.</span><span>.</span><span>.</span></span>
              </div>
            </div>
          )}

          {error && <div className="msg ai"><div className="bubble" style={{ color: '#9c5a3c' }}>{error}</div></div>}

          <div ref={bottomRef} style={{ height: 1 }} />
        </div>
      </div>

      <div className="chat-bottom">
        <div className="container">
          <div className="footer-bar">
            <button
              className="footer-toggle"
              onClick={() => setFooterOpen(!footerOpen)}
              aria-label={footerOpen ? 'ซ่อน' : 'แสดง'}
              type="button"
            >
              {footerOpen ? '▲' : '▽'}
            </button>
            {footerOpen && (
              <div className="footer-actions">
                <DanaButton context="footer" />
                <Link href="/about/dana" className="footer-link">เราใช้เงินที่คุณสนับสนุนไปกับอะไรบ้าง</Link>
              </div>
            )}
          </div>
          <div className="tone-dropdown-wrapper">
            <select
              className="tone-dropdown"
              value={tone}
              onChange={(e) => chooseTone(e.target.value)}
              aria-label="เลือกโหมดการตอบ"
            >
              {TONES.map((t) => (
                <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          <div className="input-inner">
            <textarea
              ref={taRef}
              rows={1}
              className="chat-input"
              placeholder="ถามอะไรก็ได้..."
              value={input}
              onChange={(e) => { setInput(e.target.value); autoGrow(); }}
              onKeyDown={onKey}
              onFocus={onFocusInput}
            />
            <button className="send-btn" onClick={() => submit()} disabled={loading || !input.trim()}>
              ↑
            </button>
          </div>
          <div className="free-note">ใช้งานฟรี ไม่จำกัด ไม่ต้องสมัครสมาชิก · คำตอบเป็นเพียงข้อมูลเบื้องต้น ควรศึกษาภายใต้การแนะนำของครูอาจารย์</div>
        </div>
      </div>
    </div>
  );
}
