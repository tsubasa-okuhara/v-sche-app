// src/ClientReport.tsx
import { getSessionEmail, fetchRecordsByClient, fetchClients } from './lib/api';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import { applyExpressionRules } from './lib/noteForm';
import type { StoredAnswers } from './lib/noteForm';

dayjs.locale('ja');

type ReportRow = {
  id: string;
  note_text: string | null;
  created_at: string;
  answers: StoredAnswers | null;
  schedule_tasks: {
    task_date: string;
    start_time: string;
    end_time: string;
    client_name: string;
    helper_name: string;
    destination: string | null;
    helper_email: string | null;
    weekday_text?: string | null;
  } | null;
};

// ハッシュクエリを安全に取得
function getHashParams(hashValue: string): URLSearchParams {
  const raw = hashValue.split('?')[1] || '';
  return new URLSearchParams(raw);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function ClientReport() {
  const [records, setRecords] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');
  const [hash, setHash] = useState(() => window.location.hash || '#/report');

  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsErr, setClientsErr] = useState('');

  const params = useMemo(() => getHashParams(hash), [hash]);
  const rawClient = (params.get('client') || '').trim();
  const client = rawClient ? safeDecode(rawClient) : '';
  const from = (params.get('from') || '').trim();
  const to = (params.get('to') || '').trim();

  const defaultRange = useMemo(() => ({
    from: dayjs().startOf('month').format('YYYY-MM-DD'),
    to: dayjs().endOf('month').format('YYYY-MM-DD'),
  }), []);

  const [clientInput, setClientInput] = useState(() => client);
  const [fromInput, setFromInput] = useState(() => from || defaultRange.from);
  const [toInput, setToInput] = useState(() => to || defaultRange.to);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/report');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    setClientInput(client);
    setFromInput(from || defaultRange.from);
    setToInput(to || defaultRange.to);
  }, [client, from, to, defaultRange]);

  useEffect(() => {
    let active = true;
    const loadClients = async () => {
      setClientsLoading(true);
      setClientsErr('');
      try {
        const list = await fetchClients();
        if (!active) return;
        setClientOptions(list);
      } catch (e: any) {
        if (!active) return;
        setClientsErr(e?.message || '利用者一覧の取得に失敗しました。');
      } finally {
        if (active) setClientsLoading(false);
      }
    };
    loadClients();
    return () => { active = false; };
  }, []);

  const clientList = useMemo(() => {
    const pool = new Set(clientOptions);
    if (client) pool.add(client);
    return Array.from(pool).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [clientOptions, client]);

  const filteredClients = useMemo(() => {
    const keyword = clientInput.trim();
    if (!keyword) return clientList;
    return clientList.filter(name => name.includes(keyword));
  }, [clientList, clientInput]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!client || !from || !to) {
        if (active) {
          setRecords([]);
          setLoading(false);
          setErr('');
        }
        return;
      }

      setLoading(true);
      setErr('');
      try {
        const email = await getSessionEmail();
        if (!active) return;

        if (!email) {
          setErr('ログインが必要です（メールのマジックリンクからログインしてください）');
          setRecords([]);
          return;
        }

        const allowed = await checkAllowList(email);
        if (!active) return;

        if (!allowed) {
          setErr('閲覧権限がありません（許可リストに登録が必要です）');
          setRecords([]);
          return;
        }

        const list = await fetchRecordsByClient(client, from, to);
        if (!active) return;
        setRecords(list);
      } catch (e: any) {
        if (!active) return;
        setErr(e?.message || '取得に失敗しました');
        setRecords([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [client, from, to]);

  const applyFilter = () => {
    const selectedClient = clientInput.trim();
    if (!selectedClient || !fromInput || !toInput) return;

    if (dayjs(fromInput).isAfter(dayjs(toInput))) {
      alert('開始日は終了日より前の日付を選択してください。');
      return;
    }

    const nextHash = `#/report?client=${encodeURIComponent(selectedClient)}&from=${fromInput}&to=${toInput}`;
    if (window.location.hash === nextHash) {
      return;
    }

    setRecords([]);
    setErr('');
    setLoading(true);
    window.location.hash = nextHash;
  };

  const hasSelection = Boolean(client && from && to);
  const showRecords = !loading && !err && records.length > 0;

  return (
    <div className="report-screen">
      <div className="report-filter">
        <div className="report-filter-row">
          <label>
            利用者名
            <div className="report-filter-input">
              <input
                type="search"
                value={clientInput}
                onChange={(e) => setClientInput(e.target.value)}
                placeholder="利用者名を入力または選択"
              />
              {clientInput && (
                <button
                  type="button"
                  className="report-filter-clear"
                  onClick={() => setClientInput('')}
                >
                  クリア
                </button>
              )}
            </div>
          </label>
          <label>
            期間（開始）
            <input
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
            />
          </label>
          <label>
            期間（終了）
            <input
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="report-filter-submit"
            onClick={applyFilter}
            disabled={!clientInput.trim() || !fromInput || !toInput}
          >
            表示
          </button>
        </div>

        <div className="report-filter-clients">
          {clientsLoading && <p className="report-filter-note">利用者一覧を読み込み中…</p>}
          {!clientsLoading && clientsErr && (
            <p className="report-filter-note error">{clientsErr}</p>
          )}
          {!clientsLoading && !clientsErr && filteredClients.length === 0 && (
            <p className="report-filter-note">該当する利用者が見つかりません。</p>
          )}
          {!clientsLoading && !clientsErr && filteredClients.length > 0 && (
            <div className="report-filter-client-list">
              {filteredClients.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`client-option${name === clientInput.trim() ? ' selected' : ''}`}
                  onClick={() => setClientInput(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && <p className="report-status">読み込み中…</p>}
      {!loading && err && <p className="report-status error">{err}</p>}
      {!loading && !err && !hasSelection && (
        <p className="report-status">利用者と表示期間を選択してください。</p>
      )}
      {!loading && !err && hasSelection && records.length === 0 && (
        <p className="report-status">該当データがありません。</p>
      )}

      {showRecords && (
        <div className="report-page">
          {records.map((r, idx) => {
            const t = r.schedule_tasks;
            if (!t) return null;

            const weekday = t.weekday_text ?? (dayjs(t.task_date).isValid() ? dayjs(t.task_date).format('ddd') : '');
            const baseDate = dayjs(t.task_date).isValid()
              ? dayjs(t.task_date).format('YYYY年M月D日')
              : (t.task_date || '—');
            const d = weekday ? `${baseDate}（${weekday}）` : baseDate;
            const rawNote = (r.note_text || '').trim();
            const safeNote = rawNote ? applyExpressionRules(rawNote) : '';
            const customDestination = typeof r.answers?.form?.destination === 'string' && r.answers.form.destination.trim()
              ? applyExpressionRules(r.answers.form.destination.trim())
              : '';
            const destinationDisplay = customDestination || t.destination || '—';

            return (
              <div className="report-sheet" key={r.id}>
                <table className="report-table" cellPadding={0} cellSpacing={0}>
                  <colgroup>
                    <col className="col-w-100" />
                    <col className="col-w-100" />
                    <col className="col-w-120" />
                    <col className="col-w-100" />
                    <col className="col-w-100" />
                    <col className="col-w-120" />
                  </colgroup>
                  <tbody>
                    <tr className="row-40 header-row">
                      <td colSpan={6} className="cell header-cell">サービス実施記録</td>
                    </tr>
                    <tr className="row-tight">
                      <td colSpan={2} className="cell stack">
                        <div className="cell-label">事業者名</div>
                        <div className="cell-value">ビレッジつばさ</div>
                      </td>
                      <td colSpan={2} className="cell stack">
                        <div className="cell-label">利用者確認欄</div>
                        <div className="cell-value" />
                      </td>
                      <td colSpan={2} className="cell stack">
                        <div className="cell-label">ヘルパー名</div>
                        <div className="cell-value">{t.helper_name || '—'}</div>
                      </td>
                    </tr>
                    <tr className="row-tight">
                      <td colSpan={2} className="cell stack">
                        <div className="cell-label">利用者名</div>
                        <div className="cell-value">{t.client_name || '—'}</div>
                      </td>
                      <td className="cell heading">日　付</td>
                      <td colSpan={3} className="cell value-only">{d}</td>
                    </tr>
                    <tr className="row-tight">
                      <td colSpan={2} className="cell stack">
                        <div className="cell-label">時間</div>
                        <div className="cell-value center">
                          {t.start_time || '—'} <span className="sep">〜</span> {t.end_time || '—'}
                        </div>
                      </td>
                      <td className="cell heading">行　先</td>
                      <td colSpan={3} className="cell destination-cell">
                        <div className="cell-value">{destinationDisplay}</div>
                      </td>
                    </tr>
                    <tr className="row-content note-row">
                      <td className="cell vertical-label">
                        <span className="vertical-label-text">支援内容の記録</span>
                      </td>
                      <td colSpan={5} className="cell note-area">
                        <pre className="note">{safeNote || '（記載なし）'}</pre>
                      </td>
                    </tr>
                    <tr className="row-fill">
                      <td className="cell blank remark-heading">備　考</td>
                      <td colSpan={5} className="cell remark-area" />
                    </tr>
                    <tr className="row-tight">
                      <td colSpan={2} className="cell heading">経　路</td>
                      <td className="cell center">徒歩</td>
                      <td className="cell center">バス</td>
                      <td className="cell center">電車</td>
                      <td className="cell blank" />
                    </tr>
                    <tr>
                      <td colSpan={6} className="cell no-border">
                        <div className="report-footer">
                          記録作成：{dayjs(r.created_at).format('YYYY/MM/DD HH:mm')}
                          （{idx + 1} / {records.length}）
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================
   閲覧制限：GoogleスプレッドシートのCSVを許可表として利用
   - Vercel 環境変数 VITE_ALLOWLIST_JSON_URL を優先
   - 未設定時は固定URLにフォールバック
   ========================================= */
const ALLOWLIST_CSV =
  import.meta.env.VITE_ALLOWLIST_JSON_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRrohUcfn1aiYyBBopFlUNGknS2obUfvITGi6GyQmHdsAryZeQK6Jil5-ykQmxWh__z3jW0Tj3bl9Ti/pub?gid=494265217&single=true&output=csv';

async function checkAllowList(email: string | null): Promise<boolean> {
  if (!email) return false;

  const DEBUG = false; // trueで詳細ログ

  try {
    if (DEBUG) console.log('[allowlist] CSV_URL =', ALLOWLIST_CSV, 'email=', email);

    const res = await fetch(ALLOWLIST_CSV, { cache: 'no-store' });
    if (!res.ok) {
      if (DEBUG) console.warn('許可リストの取得に失敗', res.status);
      return false;
    }

    // BOM除去＋整形
    const csv = (await res.text()).replace(/^\uFEFF/, '').trim();
    const rows = csv
      .split(/\r?\n/)
      .map(l => l.split(',').map(s => s.trim()))
      .filter(cols => cols.length >= 1);

    if (rows.length < 2) return false;

    // ヘッダからメール列のインデックス自動検出
    const header = rows[0].map(h => h.toLowerCase());
    let emailIdx = header.findIndex(h =>
      h.includes('email') || h.includes('mail') || h.includes('メール')
    );
    if (emailIdx < 0) emailIdx = 1; // なければ2列目

    // 正規化（全角スペース/クォートも除去）
    const normalize = (s: string) => s.toLowerCase().replace(/[\s"'\u3000]/g, '');
    const emails = new Set(
      rows.slice(1)
        .map(r => normalize(r[emailIdx] || ''))
        .filter(Boolean)
    );

    const ok = emails.has(normalize(email));
    if (DEBUG) console.log('[allowlist] parsed =', Array.from(emails), 'matched=', ok);
    return ok;
  } catch (e) {
    if (DEBUG) console.error('checkAllowList エラー:', e);
    return false;
  }
}
