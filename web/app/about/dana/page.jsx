// หน้าโปร่งใสด้านการเงิน — อัปเดตข้อมูลที่ web/data/dana-stats.json (ไม่ต้องแตะโค้ด)
import stats from '@/data/dana-stats.json';
import { DanaButton } from '@/components/DanaButton';

export const metadata = {
  title: 'ความโปร่งใสด้านการเงิน — Dhamma AI',
};

export default function DanaTransparencyPage() {
  const totalExpenses = stats.expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = stats.total_received - stats.total_spent;

  return (
    <main className="dana-page">
      <h1>ความโปร่งใสด้านการเงิน</h1>
      <p className="dana-page-intro">
        Dhamma AI เชื่อในความโปร่งใสค่ะ ทุกบาทที่ได้รับการสนับสนุนนำไปใช้จ่ายค่าใช้จ่ายจริงที่เกิดขึ้น
        เพื่อให้บริการนี้เปิดให้ทุกคนใช้ฟรีต่อไปได้ค่ะ
      </p>

      <section className="dana-stats-grid">
        <div className="stat-card">
          <span className="stat-number">{stats.total_received.toLocaleString()} บาท</span>
          <span className="stat-label">รับการสนับสนุนสะสม</span>
          <span className="stat-note">อัปเดตล่าสุด: {stats.last_updated}</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.questions_answered.toLocaleString()} ข้อ</span>
          <span className="stat-label">คำถามธรรมะที่ตอบไปแล้ว</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.unique_users.toLocaleString()} คน</span>
          <span className="stat-label">ผู้ใช้งานทั้งหมด</span>
        </div>
      </section>

      <section className="dana-expenses">
        <h2>ค่าใช้จ่ายที่เกิดขึ้นจริง (เดือนล่าสุด)</h2>
        <p className="expenses-note">
          ค่าใช้จ่ายทั้งหมดเป็นค่า infrastructure สำหรับให้บริการค่ะ ไม่มีค่าจ้างพนักงาน ไม่มีค่าการตลาด
        </p>
        <table className="expenses-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th>รายละเอียด</th>
              <th>บาท/เดือน</th>
            </tr>
          </thead>
          <tbody>
            {stats.expenses.map((item, i) => (
              <tr key={i}>
                <td>{item.name}</td>
                <td>{item.detail}</td>
                <td>{item.amount.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={2}>รวมค่าใช้จ่าย</td>
              <td>{totalExpenses.toLocaleString()} บาท</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="dana-balance">
        <h2>ยอดคงเหลือสะสม</h2>
        <p>
          รับมา {stats.total_received.toLocaleString()} บาท — ใช้ไป {stats.total_spent.toLocaleString()} บาท ={' '}
          คงเหลือ {balance.toLocaleString()} บาท
        </p>
        <p className="balance-note">
          ยอดคงเหลือสำรองไว้สำหรับค่าใช้จ่ายในเดือนถัดไปค่ะ ถ้าเดือนไหนรับมาเกินค่าใช้จ่าย
          จะแจ้งให้ทราบที่หน้านี้ด้วยค่ะ
        </p>
      </section>

      <section className="dana-cta">
        <p>
          ถ้าบริการนี้มีประโยชน์และอยากสนับสนุนให้ดำเนินต่อไป ยินดีรับการสนับสนุนตามกำลังศรัทธานะคะ 🙏
        </p>
        <DanaButton context="transparency-page" />
      </section>
    </main>
  );
}
