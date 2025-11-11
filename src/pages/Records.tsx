// src/pages/Records.tsx
import { useEffect, useMemo, useState } from 'react';
import { getSessionEmail, fetchMyRecords, todayISO } from '../lib/api';
import { applyExpressionRules } from '../lib/noteForm';
import '../style-records.css';

type Shaped = ReturnType<typeof shapeRecord>;
type Grouped = Record<string, Shaped[]>;

function getHashParams() {
  // 例: #/report?client=冨田様&from=2025-10-01&to=2025-10-31
  const hash = window.location.hash || '';
  const q = hash.includes('?') ? hash.split('?')[1] : '';
  return new URLSearchParams(q);
}

function shapeRecord(r: any) {
  const t = r?.schedule_tasks ?? {};
  const overrideDestination = typeof r?.answers?.form?.destination === 'string' && r.answers.form.destination.trim()
    ? r.answers.form.destination.trim()
    : '';
  return {
    id: String(r?.id || ''),
    note_text: String(r?.note_text || ''),
    created_at: String(r?.created_at || ''),
    task_date: String(t?.task_date || ''),   // 例: 2025-10-22
    start_time: String(t?.start_time || ''),
    end_time: String(t?.end_time || ''),
    client_name: String(t?.client_name || ''),
    helper_name: String(t?.helper_name || ''),
    destination: String(t?.destination || ''),
    destination_override: overrideDestination,
  };
}

export default function Records() {
  const [email, setEmail] = useState<string | null>(null);
  const [records, setRecords] = useState<Shaped[]>([]);
  const [loading, setLoading] = useState(false);

  // URL のクエリ（client/from/to）
  const params = getHashParams();
  const clientQuery = params.get('client') || '';
  const fromQuery = params.get('from') || '';
  const toQuery = params.get('to') || '';

  // UI 側でも月選択できるように fallback
  const [month, setMonth] = useState(() => {
    if (fromQuery) {
      // from 指定がある場合はそれを起点に見せたい
      const [y,m] = fromQuery.split('-').map(Number);
      return `${y}-${String(m).padStart(2, '0')}`;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthFromTo = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2,'0')}`;
    return { from, to };
  }, [month]);

  const effectiveFrom = fromQuery || monthFromTo.from;
  const effectiveTo = toQuery || monthFromTo.to;

  const load = async () => {
    setLoading(true);
    try {
      const e = await getSessionEmail();
      setEmail(e);
      if (!e) return;
      const list = await fetchMyRecords(e, effectiveFrom, effectiveTo);
      const shaped = list.map(shapeRecord);
      // client= が指定されていたらクライアント名で絞り込み
      const filtered = clientQuery
        ? shaped.filter(r => r.client_name === clientQuery)
        : shaped;
      setRecords(filtered);
    } catch (e: any) {
      alert(e.message || '記録の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // hashのfrom/to/clientが変わった場合にも再取得したい場合は以下のように
    const onHash = () => {
      // ※ 必要に応じて再読込
      // ここでは簡易実装として、ページをリロードしてパラメータ再評価
      window.location.reload();
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFrom, effectiveTo, clientQuery]);

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

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text)
      .then(() => alert('本文をコピーしました'))
      .catch(() => alert('コピーに失敗しました'));
  };

  const printOne = (id: string) => {
    // key 属性はDOMに出ないので data-id を使う
    const el = document.querySelector<HTMLElement>(`article.record-card[data-id="${id}"]`);
    if (!el) return window.print();
    el.classList.add('print-only');
    window.print();
    // ちょっと待って復元
    setTimeout(() => el.classList.remove('print-only'), 500);
  };

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
        <div>
          <b>表示期間</b>：{effectiveFrom} 〜 {effectiveTo}
        </div>
        <div className="spacer" />
        <label>
          月を選択：
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        </label>
        <button onClick={load} disabled={loading}>再読み込み</button>
        <button onClick={printAll}>一覧を印刷</button>
      </section>

      <section>
        {loading && <p>読み込み中…</p>}
        {!loading && records.length === 0 && <p>この条件の記録はありません。</p>}

        {Object.entries(grouped)
          .sort((a,b)=> a[0] < b[0] ? 1 : -1) // 新しい日付が上に来る
          .map(([date, items]) => (
          <div key={date} className="date-group">
            <h3 className="date-title">{date}</h3>
            {items.map(r => (
              <article key={r.id} data-id={r.id} className="record-card">
                <header className="record-header">
                  <div className="title">
                    <span className="client">{r.client_name || '（利用者不明）'}</span>
                    <span className="time">{r.start_time}〜{r.end_time}</span>
                  </div>
                  {(() => {
                    const dest = (r.destination_override || r.destination || '').trim();
                    return dest ? <div className="dest">〔{applyExpressionRules(dest)}〕</div> : null;
                  })()}
                </header>

                <section className="record-body">
                  <pre className="note">{applyExpressionRules((r.note_text || '').trim())}</pre>
                </section>

                <footer className="record-footer">
                  <span className="helper">担当：{r.helper_name || email || '—'}</span>
                  <div className="actions">
                    <button onClick={() => copyText(r.note_text)}>コピー</button>
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
