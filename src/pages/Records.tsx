// src/pages/Records.tsx
import { useEffect, useMemo, useState } from 'react';
import { getSessionEmail, fetchMyRecords, todayISO } from '../lib/api';

type Grouped = Record<string, ReturnType<typeof shapeRecord>[]>;

function shapeRecord(r: any) {
  // schedule_tasks は null の可能性があるため保護
  const t = r.schedule_tasks ?? {};
  return {
    id: r.id as string,
    note_text: (r.note_text as string) ?? '',
    created_at: (r.created_at as string) ?? '',
    task_date: (t.task_date as string) ?? '',
    start_time: (t.start_time as string) ?? '',
    end_time: (t.end_time as string) ?? '',
    client_name: (t.client_name as string) ?? '',
    helper_name: (t.helper_name as string) ?? '',
    destination: (t.destination as string) ?? '',
  };
}

export default function Records() {
  const [email, setEmail] = useState<string | null>(null);
  const [records, setRecords] = useState<ReturnType<typeof shapeRecord>[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthFromTo = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    return { from, to };
  }, [month]);

  const load = async () => {
    setLoading(true);
    try {
      const e = await getSessionEmail();
      setEmail(e);
      if (!e) return;
      const list = await fetchMyRecords(e, monthFromTo.from, monthFromTo.to);
      setRecords(list.map(shapeRecord));
    } catch (e: any) {
      alert(e.message || '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  // 日付でグルーピング
  const grouped = useMemo(() => {
    const g: Grouped = {};
    for (const r of records) {
      const key = r.task_date || r.created_at.slice(0, 10);
      (g[key] ||= []).push(r);
    }
    return g;
  }, [records]);

  // 印刷
  const printAll = () => window.print();

  return (
    <div className="page">
      <header className="header">
        <div className="header-title">サービス記録（{todayISO()}）</div>
        <nav className="tabs">
          <a href="/" className="tab">予定</a>
          <a href="#/records" className="tab active">記録</a>
        </nav>
      </header>

      <section className="toolbar">
        <label>
          月を選択：
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        </label>
        <div className="spacer" />
        <button onClick={load} disabled={loading}>再読み込み</button>
        <button onClick={printAll}>印刷</button>
      </section>

      <section>
        {loading && <p>読み込み中…</p>}
        {!loading && records.length === 0 && <p>この月の記録はありません。</p>}

        {Object.entries(grouped).sort((a,b)=>a[0]<b[0]?1:-1).map(([date, items]) => (
          <div key={date} className="date-group">
            <h3 className="date-title">{date}</h3>
            {items.map(r => (
              <article key={r.id} className="record-card">
                <header className="record-header">
                  <div className="title">
                    <span className="client">{r.client_name || '（利用者不明）'}</span>
                    <span className="time">
                      {r.start_time}〜{r.end_time}
                    </span>
                  </div>
                  {r.destination && <div className="dest">〔{r.destination}〕</div>}
                </header>
                <section className="record-body">
                  <pre className="note">{r.note_text}</pre>
                </section>
                <footer className="record-footer">
                  <span className="helper">担当：{r.helper_name || email || '—'}</span>
                  <div className="actions">
                    <button onClick={() => copy(r.note_text)}>コピー</button>
                    <button onClick={() => printOne(r.id)}>単票印刷</button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => alert('本文をコピーしました'),
    () => alert('コピーに失敗しました')
  );
}

// 単票印刷：対象カードだけを印刷用に表示→印刷→戻す
function printOne(id: string) {
  const el = document.querySelector(`article.record-card[key="${id}"]`) || document.querySelector(`[data-id="${id}"]`);
  if (!el) return window.print();
  el.classList.add('print-only');
  window.print();
  setTimeout(() => el.classList.remove('print-only'), 500);
}