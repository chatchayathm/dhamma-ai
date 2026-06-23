'use client';

import { useState } from 'react';
import { DanaButton } from './DanaButton';
import { sendFeedback } from '../lib/api';

// Feedback under each answer. The dana suggestion appears ONLY after the user
// explicitly taps "มีประโยชน์มาก" — never automatically. Negative feedback is
// logged for human review (Phase 5).
export function FeedbackWidget({ question, answer }) {
  const [feedback, setFeedback] = useState(null);
  const [showDana, setShowDana] = useState(false);

  function handleFeedback(type) {
    setFeedback(type);
    if (type === 'very_helpful') {
      setShowDana(true);
    } else if (type === 'not_helpful') {
      // log for review; ignore failures silently
      sendFeedback({ question, answer, reason: 'not_helpful' }).catch(() => {});
    }
  }

  return (
    <div className="feedback-widget">
      {!feedback && (
        <div className="feedback-buttons">
          <span className="feedback-label">คำตอบนี้เป็นประโยชน์ไหมคะ</span>
          <button onClick={() => handleFeedback('very_helpful')} type="button">มีประโยชน์มาก</button>
          <button onClick={() => handleFeedback('helpful')} type="button">พอใช้</button>
          <button onClick={() => handleFeedback('not_helpful')} type="button">ยังไม่ตรง</button>
        </div>
      )}

      {feedback === 'very_helpful' && showDana && (
        <div className="dana-suggestion">
          <p className="dana-suggestion-text">
            ดีใจที่คำตอบมีประโยชน์นะคะ 🙏 ถ้าอยากสนับสนุนให้บริการนี้ดำเนินต่อไป
            ยินดีรับการสนับสนุนตามกำลังศรัทธาค่ะ
          </p>
          <DanaButton context="after-feedback" />
          <button className="dana-skip" onClick={() => setShowDana(false)} type="button">
            ไม่เป็นไรค่ะ
          </button>
        </div>
      )}

      {feedback && feedback !== 'very_helpful' && (
        <p className="feedback-thanks">ขอบคุณสำหรับ feedback นะคะ 🙏</p>
      )}
    </div>
  );
}
