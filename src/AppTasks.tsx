// src/AppTasks.tsx
import { useEffect, useState, useMemo } from 'react';
import {
  getSessionEmail,
  signInMagicLink,
  // View 方式（v_tasks_todo）で未入力のタスクだけ表示
  fetchTasksTodoByEmail as fetchTasksByEmail,
  submitNote,
  todayISO,
  fetchNoteText,
} from './lib/api';

/* ---------------- Login ---------------- */
function Login({ onConfirmed }: { onConfirmed: () => void | Promise<void> }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await signInMagicLink(email);
      alert('メールのリンクを開いた後に「ログイン済みを確認」を押してください。');
    } catch (e: any) {
      alert(e.message || '送信に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '24px auto', padding: '8px' }}>
      <h2>メールでログイン</h2>
      <input
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: '100%', padding: 12, fontSize: 16 }}
      />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={send} disabled={busy} style={{ padding: '10px 14px' }}>マジックリンク送信</button>
        <button onClick={onConfirmed} style={{ padding: '10px 14px' }}>ログイン済みを確認</button>
      </div>
    </div>
  );
}

/* ---------------- Editor ---------------- */
function Editor({ task, onClose }: { task: any; onClose: () => void }) {
  const [memo, setMemo] = useState('');
  const [phase, setPhase] = useState<'idle' | 'saving' | 'formatting' | 'done' | 'error'>('idle');
  const [preview, setPreview] = useState('');

  // note_text を待つ（ポーリング）
  const waitForNoteText = async (noteId: string, timeoutMs = 20000, intervalMs = 800) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const txt = await fetchNoteText(noteId);
      if (txt && txt.trim().length > 0) return txt;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('AI整形が遅延しています。少し待って再読込してください。');
  };

  const send = async () => {
    if (!memo.trim()) {
      alert('実績メモを入力してください');
      return;
    }
    try {
      setPhase('saving');
      const noteId = await submitNote(task.id, { actual: memo.trim() }); // upsert → AI実行（api.ts で done まで）

      setPhase('formatting');
      const text = await waitForNoteText(noteId); // 整形文を取得
      setPreview(text);
      setPhase('done');
    } catch (e: any) {
      setPhase('error');
      alert(e.message || '送信に失敗しました');
    }
  };

  const Btn = ({ label }: { label: string }) => (
    <button
      disabled={phase === 'saving' || phase === 'formatting'}
      onClick={send}
      style={{
        padding: '10px 14px',
        background: phase === 'saving' || phase === 'formatting' ? '#9ca3af' : '#16a34a',
        color: '#fff',
        border: 0,
        borderRadius: 8,
      }}
    >
      {phase === 'saving' && '保存中…'}
      {phase === 'formatting' && 'AI整形中…'}
      {(phase === 'idle' || phase === 'error' || phase === 'done') && label}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)' }}>
      <div style={{ background: '#fff', maxWidth: 560, margin: '40px auto', padding: 16, borderRadius: 12 }}>
        <h3>{task.client_name} / {task.task_date}</h3>
        <div style={{ color: '#666' }}>{task.start_time}〜{task.end_time} / {task.destination || '—'}</div>

        {phase !== 'done' && (
          <>
            <label>実績メモ（短くOK）</label>
            <textarea rows={4} value={memo} onChange={(e) => setMemo(e.target.value)} style={{ width: '100%', marginTop: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Btn label="送信" />
              <button onClick={onClose} style={{ padding: '10px 14px' }}>閉じる</button>
            </div>
            {phase !== 'idle' && (
              <p style={{ color: '#666', marginTop: 8 }}>
                {phase === 'saving' && '保存中…（service_notes に記録を保存）'}
                {phase === 'formatting' && 'AI整形中…（数秒かかることがあります）'}
                {phase === 'error' && 'エラーが発生しました'}
              </p>
            )}
          </>
        )}

        {phase === 'done' && (
          <>
            <h4 style={{ marginTop: 8 }}>AI整形結果（保存済み）</h4>
            <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginTop: 6 }}>
              {preview}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={onClose} style={{ padding: '10px 14px' }}>閉じる</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function AppTasks() {
  const [email, setEmail] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const dateISO = useMemo(() => todayISO(), []);

  const load = async () => {
    setLoading(true);
    try {
      const e = await getSessionEmail();
      setEmail(e);
      if (!e) return;
      const list = await fetchTasksByEmail(e); // v_tasks_todo 由来：未入力のみ
      setTasks(list);
    } catch (e: any) {
      alert(e.message || '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (!email) return <Login onConfirmed={load} />;

  return (
    <div style={{ maxWidth: 720, margin: '16px auto', padding: '12px' }}>
      <h2>自分の予定一覧（{dateISO}）</h2>
      <div style={{ color: '#666' }}>ログイン: {email}</div>
      <button onClick={load} style={{ margin: '8px 0', padding: '6px 10px' }}>再読み込み</button>

      {loading && <p>読み込み中…</p>}
      {!loading && tasks.length === 0 && <p>予定がありません。</p>}

      {!loading && tasks.length > 0 && (
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          {tasks.map((t) => (
            <div key={t.id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{t.client_name}</div>
                {t.status === 'submitted' && (
                  <span style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', padding: '2px 6px', borderRadius: 8 }}>送信中</span>
                )}
                {t.status === 'done' && (
                  <span style={{ fontSize: 12, color: '#065f46', background: '#d1fae5', padding: '2px 6px', borderRadius: 8 }}>完了</span>
                )}
              </div>
              <div style={{ color: '#666' }}>{t.start_time}〜{t.end_time} / {t.destination}</div>
              <button
                onClick={() => setEditing(t)}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, marginTop: 8 }}>
                記録を入力
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && <Editor task={editing} onClose={() => { setEditing(null); load(); }} />}
    </div>
  );
}

