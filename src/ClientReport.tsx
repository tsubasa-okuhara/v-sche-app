import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import { fetchClients, fetchRecordsByClient } from './lib/api';

// 帳票 1レコードの型（fetchRecordsByClient の戻り値の要素）
type ReportRow = {
  id: string;
  note_text: string | null;
  created_at: string;
  schedule_tasks: {
    task_date: string;
    start_time: string;
    end_time: string;
    client_name: string;
    helper_name: string;
    destination: string | null;
    helper_email: string | null;
  } | null;
};

// URL クエリのヘルパ
const getQuery = (key: string) => new URL(window.location.href).searchParams.get(key) ?? '';
const setQueries = (q: Record<string, string | undefined>) => {
  const url = new URL(window.location.href);
  Object.entries(q).forEach(([k, v]) => {
    if (v && v.length) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  });
  window.history.replaceState(null, '', url.toString());
};

dayjs.locale('ja');

export default function ClientReport() {
  const [clients, setClients] = useState<string[]>([]);
  const [client, setClient] = useState<string>(getQuery('client'));
  const [month, setMonth] = useState<string>(getQuery('month') || dayjs().format('YYYY-MM')); // yyyy-MM
  const [from, setFrom] = useState<string>(getQuery('from') || '');
  const [to, setTo] = useState<string>(getQuery('to') || '');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string>('');

  // 初回：利用者一覧
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchClients();
        setClients(list);
        // クエリに client が無い場合、先頭で自動選択（任意）
        if (!client && list.length) setClient(list[0]);
      } catch (e: any) {
        console.error(e);
        setError(e.message || '利用者候補の取得に失敗しました');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 検索
  const doSearch = async () => {
    if (!client) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 月指定があるときは from/to を優先生成
      let _from = from;
      let _to = to;
      if (month) {
        const d = dayjs(`${month}-01`);
        _from = d.startOf('month').format('YYYY-MM-DD');
        _to = d.endOf('month').format('YYYY-MM-DD');
      }
      // URL 反映
      setQueries({ client, month, from: _from, to: _to });

      const list = await fetchRecordsByClient(client, _from, _to);
      setRows(list);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 初期ロード（クエリに client があれば実行）
  useEffect(() => {
    if (client) doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // 日付でグループ
  const groups = useMemo(() => {
    const bucket = new Map<string, ReportRow[]>();
    for (const r of rows) {
      const d = r.schedule_tasks?.task_date ?? '未設定';
      const arr = bucket.get(d) || [];
      arr.push(r);
      bucket.set(d, arr);
    }
    // 日付昇順で並べて返す
    return Array.from(bucket.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ja'));
  }, [rows]);

  // 印刷
  const handlePrint = () => window.print();

  // 月⇔任意期間の切替（任意）
  const [useRange, setUseRange] = useState<boolean>(Boolean(from || to));

  return (
    <div className="page">
      {/* ヘッダ */}
      <div className="header">
        <div className="header-title">サービス実施記録（帳票プレビュー）</div>
        <div className="tabs">
          {/* 帳票以外のタブを後で増やすときのために残しています */}
          <a className="tab active" href="#">帳票</a>
        </div>
      </div>

      {/* ツールバー */}
      <div className="toolbar">
        <div>
          <label style={{ marginRight: 8 }}>利用者：</label>
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6 }}
          >
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <label style={{ marginLeft: 16 }}>
          <input
            type="checkbox"
            checked={useRange}
            onChange={(e) => setUseRange(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          任意期間で検索
        </label>

        {!useRange ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>月：</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label>開始：</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label>終了：</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}

        <div className="spacer" />

        <button onClick={doSearch} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
          再読込
        </button>
        <button onClick={handlePrint} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
          印刷
        </button>
      </div>

      {/* 本文 */}
      {loading && <p>読み込み中…</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {!loading && !error && rows.length === 0 && client && <p>該当データがありません。</p>}

      {!loading && !error && groups.map(([date, list]) => (
        <section className="date-group" key={date}>
          <h3 className="date-title">{dayjs(date).isValid() ? dayjs(date).format('YYYY年M月D日（ddd）') : date}</h3>

          {list.map((r) => {
            const s = r.schedule_tasks;
            const clientName = s?.client_name ?? '';
            const helper = s?.helper_name ?? '';
            const time = `${s?.start_time ?? ''} ～ ${s?.end_time ?? ''}`;
            const dest = s?.destination || '—';
            const note = (r.note_text ?? '').trim();

            return (
              <article className="record-card" key={r.id}>
                <header className="record-header">
                  <div className="title">
                    <span className="client">{clientName}</span>
                    <span className="time">{time}</span>
                  </div>
                  <div className="dest">{dest}</div>
                </header>

                <div className="record-body">
                  <p className="note">{note || '（実績テキスト未入力）'}</p>
                </div>

                <footer className="record-footer">
                  <div>ヘルパー：{helper}</div>
                  <div>記録作成：{dayjs(r.created_at).format('YYYY/MM/DD HH:mm')}</div>
                  <div className="actions">
                    {/* 将来：単票印刷やCSV出力を付けたい場合ここに */}
                  </div>
                </footer>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}