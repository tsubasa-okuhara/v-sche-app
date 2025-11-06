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
                {/* 1) 上部のラベル行 */}
                <tr>
                  <td className="label">事業所名</td>
                  <td colSpan={3} className="value">ビレッジつばさ</td>

                  <td className="label">利用者確認欄</td>
                  <td colSpan={2} className="value">
                    {/* サイン欄にしたい場合は下を有効化 */}
                    {/* <div className="sign-box" /> */}
                  </td>

                  <td className="label">ヘルパー名</td>
                  <td className="value">{t.helper_name || '—'}</td>
                </tr>

                {/* 2) 利用者名／日付 */}
                <tr>
                  <td className="label">利用者名</td>
                  <td colSpan={2} className="value">{t.client_name || '—'}</td>

                  <td className="label">日付</td>
                  <td colSpan={5} className="value">{d}</td>
                </tr>

                {/* 3) 時間 */}
                <tr>
                  <td className="label">時間</td>
                  <td colSpan={8} className="value center">
                    {t.start_time || '—'} <span className="sep">〜</span> {t.end_time || '—'}
                  </td>
                </tr>

                {/* 4) 見出し帯（行先／主な援助内容／備考） */}
                <tr className="band">
                  <td className="band-cell center" colSpan={2}>行　先</td>
                  <td className="band-cell center" colSpan={7}>主な援助内容・備考</td>
                </tr>

                {/* 5) 行先＋主な援助内容＋備考（ベージュ） */}
                <tr>
                  <td className="sidehead center">記</td>
                  <td className="beige" colSpan={2}>
                    {/* 行先などを入れたい場合はここに */}
                    {t.destination || '—'}
                  </td>
                  <td className="beige note-cell" colSpan={6}>
                    <div className="note-heading">備考</div>
                    <pre className="note">{(r.note_text || '').trim() || '（記載なし）'}</pre>
                  </td>
                </tr>

                {/* 6) 経路帯 */}
                <tr className="band thin-top">
                  <td className="sidehead center">録</td>
                  <td className="band-cell center" colSpan={2}>経　路</td>
                  <td className="band-cell light" colSpan={6}></td>
                </tr>

                {/* 7) 交通手段／余白 */}
                <tr>
                  <td className="sidehead center">レ</td>
                  <td className="beige center w-veh" colSpan={2}>徒歩</td>
                  <td className="beige center w-veh" colSpan={2}>バス</td>
                  <td className="beige center w-veh" colSpan={2}>電車</td>
                  <td className="light" colSpan={2}></td>
                </tr>

                {/* 8) フッター */}
                <tr>
                  <td colSpan={9} className="no-border">
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
