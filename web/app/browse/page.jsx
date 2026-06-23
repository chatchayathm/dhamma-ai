'use client';

import { useEffect, useState } from 'react';
import { listVolumes, browseVolume, readChapter } from '../../lib/api';

const PITAKA_ORDER = ['วินัยปิฎก', 'สุตตันตปิฎก', 'อภิธรรมปิฎก'];

function ChapterRow({ volume, ch }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && text == null) {
      setLoading(true);
      setErr('');
      try {
        const d = await readChapter({ volume, sutta_number: ch.sutta_number, sutta_name: ch.sutta_name });
        setText(d.chunks.map((c) => c.text).join('\n\n'));
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div>
      <button className="chapter-row chapter-btn" onClick={toggle}>
        <span>{open ? '▾ ' : '▸ '}{ch.sutta_name}</span>
        <span className="cnum">{ch.sutta_number ? `ข้อ ${ch.sutta_number}` : ''}</span>
      </button>
      {open && (
        <div className="chapter-text">
          {loading && <span className="meta-dim">กำลังโหลดเนื้อความ…</span>}
          {err && <span style={{ color: '#9c5a3c' }}>{err}</span>}
          {text != null && (text ? <div className="source-text">{text}</div> : <span className="meta-dim">ไม่พบเนื้อความ</span>)}
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  const [volumes, setVolumes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listVolumes()
      .then((d) => setVolumes(d.volumes))
      .catch((e) => setError(e.message));
  }, []);

  async function open(v) {
    setSelected(v);
    setDetail(null);
    setLoading(true);
    setError('');
    try {
      setDetail(await browseVolume(v.volume));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (selected) {
    return (
      <div className="browse-wrap">
        <button className="back-btn" onClick={() => setSelected(null)}>← กลับไปรายการเล่ม</button>
        <div className="pitaka-title">
          เล่มที่ {selected.volume} · {selected.pitaka}
          {selected.nikaya ? ` — ${selected.nikaya}` : ''}
        </div>
        <h2 style={{ marginTop: 4, color: 'var(--brown)' }}>{selected.title}</h2>
        {detail?.volume_info?.total_chunks != null && (
          <p className="meta-dim">{detail.volume_info.total_chunks} ส่วนข้อมูล · {detail.chapters.length} หัวข้อ</p>
        )}
        {loading && <p className="meta-dim">กำลังโหลด…</p>}
        {error && <p style={{ color: '#9c5a3c' }}>{error}</p>}
        <div className="chapter-list">
          {detail?.chapters?.map((ch, i) => (
            <ChapterRow key={i} volume={selected.volume} ch={ch} />
          ))}
        </div>
      </div>
    );
  }

  const byPitaka = PITAKA_ORDER.map((p) => ({
    pitaka: p,
    vols: volumes.filter((v) => v.pitaka === p),
  }));

  return (
    <div className="browse-wrap">
      <h1 style={{ color: 'var(--brown)' }}>เรียกดูพระไตรปิฎก</h1>
      <p className="meta-dim">ฉบับสยามรัฐ 45 เล่ม · เลือกเล่มเพื่อดูรายการพระสูตร/หัวข้อ</p>
      {error && <p style={{ color: '#9c5a3c' }}>{error}</p>}
      {byPitaka.map((g) => (
        <div className="pitaka-group" key={g.pitaka}>
          <div className="pitaka-title">{g.pitaka}</div>
          <div className="vol-grid">
            {g.vols.map((v) => (
              <button className="vol-card" key={v.volume} onClick={() => open(v)}>
                <div className="vno">เล่มที่ {v.volume}</div>
                <div className="vtitle">{v.title}</div>
                {v.nikaya && <div className="vnik">{v.nikaya}</div>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
