'use client';

import { useState } from 'react';

// Inline panel (not a popup). Explains exactly where contributions go, offers
// suggested amounts + PromptPay placeholders to fill in later. No pressure, no
// guilt language. Closing/skipping is always one click away.
export function DanaPanel({ onClose }) {
  const [customAmount, setCustomAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const suggestedAmounts = [20, 100, 500];

  if (submitted) {
    return (
      <div className="dana-thankyou">
        <p>ขอบคุณที่สนับสนุนการเผยแผ่ธรรมะนะคะ 🙏</p>
        <p className="dana-thankyou-sub">
          ทุกบาทที่สนับสนุนนำไปใช้จ่ายค่า API และ server เพื่อให้ Dhamma AI
          เปิดให้ทุกคนได้ใช้ฟรีต่อไปค่ะ
        </p>
        <button className="dana-close" onClick={onClose}>ปิด</button>
      </div>
    );
  }

  return (
    <div className="dana-panel">
      <p className="dana-desc">
        Dhamma AI ให้บริการฟรีโดยไม่มีโฆษณาค่ะ ค่าใช้จ่ายที่เกิดขึ้นจริงคือค่า Claude API
        ค่า Voyage API และค่า cloud server ถ้าคำตอบที่ได้มีประโยชน์
        และอยากสนับสนุนให้บริการนี้ดำเนินต่อไป ยินดีรับการสนับสนุนตามกำลังศรัทธาค่ะ
      </p>

      <div className="dana-amounts">
        {suggestedAmounts.map((amount) => (
          <button
            key={amount}
            className={`dana-amount-btn${customAmount === String(amount) ? ' selected' : ''}`}
            onClick={() => setCustomAmount(String(amount))}
            type="button"
          >
            {amount} บาท
          </button>
        ))}
      </div>

      <input
        type="number"
        placeholder="จำนวนอื่น (บาท)"
        value={customAmount}
        onChange={(e) => setCustomAmount(e.target.value)}
        className="dana-custom-input"
        min="1"
      />

      {/* ───── Payment section — แทนที่ placeholder ด้วยข้อมูลจริงได้เลย ───── */}
      <div className="dana-payment-placeholder">
        {/* PromptPay QR:
            แทนที่ <div className="qr-box">…</div> ทั้งก้อนด้วย
            <img src="/images/promptpay-qr.png" alt="PromptPay QR" className="qr-box" />
            (วางไฟล์รูปไว้ที่ web/public/images/promptpay-qr.png) */}
        <div className="dana-qr-placeholder">
          <div className="qr-box">[ QR Code PromptPay จะแสดงที่นี่ ]</div>
        </div>

        {/* เลขบัญชี: แก้ 3 บรรทัดนี้เป็นข้อมูลจริง */}
        <div className="dana-account-placeholder">
          <p className="account-label">PromptPay หมายเลข</p>
          <p className="account-number">[ เบอร์โทร / เลขบัตรประชาชน ]</p>
          <p className="account-name">[ ชื่อบัญชี ]</p>
        </div>
      </div>

      <button
        className="dana-confirm-btn"
        onClick={() => setSubmitted(true)}
        disabled={!customAmount || Number(customAmount) < 1}
        type="button"
      >
        โอนแล้ว — ขอบคุณค่ะ
      </button>

      <p className="dana-footer-note">
        ไม่สะดวกสนับสนุนในตอนนี้ก็ใช้บริการได้เต็มที่นะคะ Dhamma AI เปิดให้ทุกคนใช้ฟรีเสมอค่ะ 🙏
      </p>

      <button className="dana-close" onClick={onClose} type="button">ปิด</button>
    </div>
  );
}
