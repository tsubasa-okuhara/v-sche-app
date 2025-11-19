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
import ServiceNoteForm from './components/ServiceNoteForm';
import {
  hasFormContent,
  applyExpressionRules,
  serializeAnswers,
} from './lib/noteForm';
import ServiceNoteChat from './components/ServiceNoteChat';
import {
  createEmptyServiceNoteFields,
  cloneServiceNoteFields,
  serviceNoteFieldsToNoteForm,
} from './lib/serviceNoteSchema';
import type { ServiceNoteFields } from './lib/serviceNoteSchema';

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
  const initialForm = useMemo(() => {
    const base = createEmptyServiceNoteFields();
    base.destination = applyExpressionRules(task.destination || '');
    return base;
  }, [task.id, task.destination]);

  const [form, setForm] = useState<ServiceNoteFields>(initialForm);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'formatting' | 'done' | 'error'>('idle');
  const [preview, setPreview] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSummary, setChatSummary] = useState('');

  useEffect(() => {
    setForm(initialForm);
    setPhase('idle');
    setPreview('');
    setChatOpen(false);
    setChatSummary('');
  }, [initialForm]);

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
    const formState = serviceNoteFieldsToNoteForm(form);

    if (!hasFormContent(formState)) {
      alert('チェック項目または実績メモを入力してください');
      return;
    }
    try {
      setPhase('saving');
      const answers = serializeAnswers(formState);
      const noteId = await submitNote(task.id, answers); // upsert → AI実行（api.ts で done まで）

      setPhase('formatting');
      const text = await waitForNoteText(noteId); // 整形文を取得
      setPreview(applyExpressionRules((text || '').trim()));
      setPhase('done');
    } catch (e: any) {
      setPhase('error');
      alert(e.message || '送信に失敗しました');
    }
  };

  const Btn = ({ label, disabled }: { label: string; disabled?: boolean }) => (
    <button
      disabled={disabled || phase === 'saving' || phase === 'formatting'}
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
      <div
        style={{
          background: '#fff',
          maxWidth: 560,
          margin: '40px auto',
          padding: 16,
          borderRadius: 12,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h3>{task.client_name} / {task.task_date}</h3>
        <div style={{ color: '#666' }}>{task.start_time}〜{task.end_time} / {form.destination || task.destination || '—'}</div>

        {phase !== 'done' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #60a5fa',
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  fontWeight: 600,
                }}
              >
                🗣 会話で入力
              </button>
            </div>
            <ServiceNoteForm
              value={form}
              onChange={(next) => setForm(cloneServiceNoteFields(next))}
              disabled={phase === 'saving' || phase === 'formatting'}
            />
            {chatSummary && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: '#ecfccb',
                  color: '#3f6212',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>AI要約（会話入力）</div>
                {chatSummary}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Btn
                label="送信"
                disabled={!hasFormContent(serviceNoteFieldsToNoteForm(form))}
              />
              <button onClick={onClose} style={{ padding: '10px 14px' }}>閉じる</button>
            </div>
            {phase !== 'idle' && (
              <p style={{ color: '#666', marginTop: 8 }}>
                {phase === 'saving' && '保存中…（チェック内容を保存しています）'}
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
        {chatOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(17, 24, 39, 0.85)',
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              padding: '16px',
              zIndex: 50,
            }}
          >
            <div
              style={{
                background: '#fff',
                width: 'min(640px, 100%)',
                maxHeight: '100%',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>会話モード</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    質問に答えるだけでフォームに反映されます。
                  </div>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                  }}
                >
                  閉じる
                </button>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <ServiceNoteChat
                  value={form}
                  onChange={(next) => setForm(cloneServiceNoteFields(next))}
                  onComplete={({ fields, summary }) => {
                    setForm(cloneServiceNoteFields(fields));
                    setChatSummary(summary);
                  }}
                  onClose={() => setChatOpen(false)}
                />
              </div>
            </div>
          </div>
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

  if (!email) {
    const devEmail = 'village.tsubasa.4499@gmail.com'; // あなたの普段使っているメール

    return (
      <>
        <Login onConfirmed={load} />
        {/* 🔧 開発用：メール認証をスキップして予定一覧に入るボタン */}
        <div style={{ maxWidth: 720, margin: '16px auto', padding: '8px' }}>
          <button
            type="button"
            onClick={async () => {
              try {
                setLoading(true);
                // 開発用：強制的に email をセット
                setEmail(devEmail);
                // そのメールに紐づくタスク一覧を取得
                const list = await fetchTasksByEmail(devEmail);
                setTasks(list);
              } catch (e: any) {
                alert(e.message || '開発用ログインに失敗しました');
              } finally {
                setLoading(false);
              }
            }}
            style={{
              marginTop: 8,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #f97316',
              background: '#ffedd5',
              color: '#9a3412',
              fontSize: 13,
            }}
          >
            🔧 開発用：メール認証をスキップして予定一覧に入る
          </button>
        </div>
      </>
    );
  }
  
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

useEffect(() => { load(); },