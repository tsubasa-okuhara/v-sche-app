// src/ClientReport.tsx
import { getSessionEmail, fetchRecordsByClient } from './lib/api';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';

dayjs.locale('ja');

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

// ハッシュクエリを安全に取得
function getHashParams(): URLSearchParams {
  const raw = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(raw);
}

export default function ClientReport() {
  const [records, setRecords] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  // クエリ読み取り（日本語にも対応）
  const p = getHashParams();
  const client = decodeURIComponent((p.get('client') || '').trim());
  const from   = (p.get('from') || '').trim();
  const to     = (p.get('to')   || '').trim();

  // ▼ ① 許可チェック＋データ取得
  useEffect(() => {
    (async () => {
      try {
        if (!client || !from || !to) {
          setErr('client / from / to を指定してください');
          setLoading(false);
          return;
        }

        const email = await getSessionEmail();
        if (!email) {
          setErr('ログインが必要です（メールのマジックリンクからログインしてください）');
          setLoading(false);
          return;
        }

        const allowed = await checkAllowList(email);
        if (!allowed) {
          setErr('閲覧権限がありません（許可リストに登録が必要です）');
          setLoading(false);
          return;
        }

        const list = await fetchRecordsByClient(client, from, to);
        setRecords(list);
      } catch (e: any) {
        setErr(e?.message || '取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [client, from, to]);

  // ▼ ② ハッシュ変更時に再評価（簡易：リロード）
  useEffect(() => {
    const onHash = () => location.reload();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (loading) return <p style={{ padding: '16px' }}>読み込み中…</p>;
  if (err)     return <p style={{ padding: '16px', color: '#b91c1c' }}>{err}</p>;
  if (records.length === 0) return <p style={{ padding: '16px' }}>該当データがありません。</p>;

  return (
    <div className="report-page">
      {records.map((r, idx) => {
        const t = r.schedule_tasks;
        if (!t) return null;

        const d = dayjs(t.task_date).isValid()
          ? dayjs(t.task_date).format('YYYY年M月D日（ddd）')
          : (t.task_date || '—');

        return (
          <div className="report-sheet" key={r.id}>
            <h2 className="report-title">サービス実施記録</h2>

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
                    <div className="cell-value">{t.destination || '—'}</div>
                  </td>
                </tr>
                <tr className="row-content note-row">
                  <td className="cell heading">録</td>
                  <td colSpan={5} className="cell note-area">
                    <pre className="note">{(r.note_text || '').trim() || '（記載なし）'}</pre>
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
