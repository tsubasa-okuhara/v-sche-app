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
              <tbody>
                <tr>
                  <td className="label">事業所名</td>
                  <td colSpan={3}>ビレッジつばさ</td>
                  <td className="label">利用者確認欄</td>
                  <td colSpan={2}></td>
                  <td className="label">ヘルパー名</td>
                  <td>{t.helper_name || '—'}</td>
                </tr>
                <tr>
                  <td className="label">利用者名</td>
                  <td colSpan={2}>{t.client_name || '—'}</td>
                  <td className="label">日付</td>
                  <td colSpan={5}>{d}</td>
                </tr>
                <tr>
                  <td className="label">時間</td>
                  <td colSpan={8}>{t.start_time || '—'} 〜 {t.end_time || '—'}</td>
                </tr>
                <tr>
                  <td className="label">行先</td>
                  <td colSpan={8}>{t.destination || '—'}</td>
                </tr>
                <tr>
                  <td className="label">主な援助内容</td>
                  <td colSpan={8}>
                    <pre className="note">{(r.note_text || '').trim() || '（実績テキスト未入力）'}</pre>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="report-footer">
              記録作成：{dayjs(r.created_at).format('YYYY/MM/DD HH:mm')}（{idx + 1} / {records.length}）
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================
   閲覧制限：GoogleスプレッドシートのCSVを許可表として利用
   - Vercel 環境変数 VITE_ALLOWLIST_JSON_URL に CSV 公開URLを登録
   - 1行目がヘッダ、メール列は自動検出
   ========================================= */
const ALLOWLIST_CSV =
  import.meta.env.VITE_ALLOWLIST_JSON_URL ||
  'https://docs.google.com/spreadsheets/d/【ID】/pub?gid=【GID】&single=true&output=csv';

async function checkAllowList(email: string | null): Promise<boolean> {
  if (!email) return false;

  try {
    const res = await fetch(ALLOWLIST_CSV, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('許可リストの取得に失敗しました', res.status);
      return false;
    }

    // BOM除去 + 前後空白除去 + CRLF対応
    const csv = (await res.text()).replace(/^\uFEFF/, '').trim();

    // CSVを配列に
    const rows = csv
      .split(/\r?\n/)
      .map(line => line.split(',').map(v => v.trim()))
      .filter(cols => cols.length >= 1);

    if (rows.length < 2) return false;

    // ヘッダからメール列のインデックスを自動検出（email / mail / メール）
    const header = rows[0].map(h => h.toLowerCase());
    let emailIdx = header.findIndex(h =>
      h.includes('email') || h.includes('mail') || h.includes('メール')
    );
    if (emailIdx < 0) emailIdx = 1; // なければ2列目を既定

    const emails = new Set(
      rows.slice(1)
        .map(r => (r[emailIdx] || '').toLowerCase())
        .filter(Boolean)
    );

    return emails.has(email.toLowerCase());
  } catch (err) {
    console.error('checkAllowList エラー:', err);
    return false;
  }
}