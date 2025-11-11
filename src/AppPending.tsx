// src/AppPending.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  getSessionEmail,
  todayISO,
  fetchMyPendingNotes,
  submitNote,
  signInMagicLink,   // ← 追加
} from './lib/api';
import ServiceNoteForm from './components/ServiceNoteForm';
import type { NoteFormState, StoredAnswers } from './lib/noteForm';
import {
  serializeAnswers,
  restoreFormState,
  hasFormContent,
} from './lib/noteForm';

type EditorTask = {
  noteId?: string;
  taskId: string;
  title: string;
  when: string;
  dest?: string | null;
  answers?: StoredAnswers | null;
};

/* ログインフォーム（マジックリンク） */
function Login({ onConfirmed }: { onConfirmed: () => void | Promise<void> }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await signInMagicLink(email);
      alert('受信メールのリンクを開いた後に「ログイン済みを確認」を押してください。');
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
        <button onClick={send} disabled={busy} style={{ padding: '10px 14px' }}>
          マジックリンク送信
        </button>
        <button onClick={onConfirmed} style={{ padding: '10px 14px' }}>
          ログイン済みを確認
        </button>
      </div>
      <p style={{ color: '#666' }}>※ログイン後に未入力の記録が表示されます。</p>
    </div>
  );
}

/* 記録入力モーダル */
function Editor({ task, onClose }: { task: EditorTask; onClose: () => void }) {
  const initialForm = useMemo(() =>
    restoreFormState(task.answers, { destination: task.dest || '' }),
    [task.noteId, task.taskId, task.dest, task.answers]
  );
  const [form, setForm] = useState<NoteFormState>(initialForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const send = async () => {
    if (!hasFormContent(form)) {
      alert('チェック項目または実績メモを入力してください');
      return;
    }
    setBusy(true);
    try {
      const answers = serializeAnswers(form);
      await submitNote(task.taskId, answers); // upsert → AI整形
      alert('送信しました。ありがとうございます！');
      onClose();
    } catch (e: any) {
      alert(e.message || '送信に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.35)'}}>
      <div style={{background:'#fff',maxWidth:560,margin:'40px auto',padding:16,borderRadius:12,maxHeight:'80vh',overflowY:'auto'}}>
        <h3>{task.title} / {task.when}</h3>
        <div style={{color:'#666',marginBottom:8}}>予定：{form.destination || task.dest || '—'}</div>
        <ServiceNoteForm
          value={form}
          onChange={setForm}
          disabled={busy}
        />
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button onClick={send} disabled={busy || !hasFormContent(form)}
            style={{padding:'10px 14px', background:'#16a34a', color:'#fff', border:0, borderRadius:8}}>送 信</button>
          <button onClick={onClose} style={{padding:'10px 14px'}}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

/* 未入力ノート一覧アプリ */
export default function AppPending() {
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditorTask | null>(null);

  const dateISO = useMemo(()=>todayISO(), []);

  const load = async () => {
    setLoading(true);
    try {
      const e = await getSessionEmail();
      setEmail(e);
      const list = await fetchMyPendingNotes(e || undefined); // note_text が NULL/空のもの
      setPending(list);
    } catch (e:any) {
      alert(e.message || '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); }, []);

  // ★ 未ログイン時は Login を表示
  if (!email) {
    return <Login onConfirmed={load} />;
  }

  return (
    <div style={{maxWidth:720,margin:'16px auto',padding:'12px'}}>
      <h2>未入力のサービス記録（{dateISO}）</h2>
      <div style={{color:'#666'}}>ログイン: {email || '—'}</div>
      <button onClick={load} style={{margin:'8px 0',padding:'6px 10px'}}>再読み込み</button>

      {loading && <p>読み込み中…</p>}
      {!loading && pending.length === 0 && <p>未入力の記録はありません。</p>}

      {!loading && pending.length > 0 && (
        <div style={{display:'grid',gap:12,marginTop:8}}>
          {pending.map((n: any) => {
            const t = n.schedule_tasks;
            const title = `${t?.client_name ?? '—'} / ${t?.helper_name ?? '—'}`;
            const when = `${t?.task_date ?? ''} ${t?.start_time ?? ''}〜${t?.end_time ?? ''}`;
            const draftMemo = n.answers?.form?.memo || n.answers?.actual || '';
            const customDest = typeof n.answers?.form?.destination === 'string' && n.answers.form.destination.trim()
              ? n.answers.form.destination.trim()
              : '';
            const shownDest = customDest || t?.destination || '—';
            return (
              <div key={n.id} style={{border:'1px solid #e5e7eb',borderRadius:12,padding:12}}>
                <div style={{fontWeight:600}}>{title}</div>
                <div style={{color:'#666'}}>{when}</div>
                <div style={{color:'#666'}}>予定：{shownDest}</div>
                <div style={{color:'#999',margin:'6px 0'}}>下書き：{draftMemo ? draftMemo.slice(0, 60) : '（未入力）'}</div>
                <button
                  onClick={()=> setEditing({
                    noteId: n.id,
                    taskId: n.task_id,
                    title,
                    when,
                    dest: shownDest,
                    answers: n.answers as StoredAnswers | null,
                  })}
                  style={{padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:8}}
                >
                  記録を入力
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && <Editor task={editing} onClose={() => { setEditing(null); load(); }} />}
    </div>
  );
}
