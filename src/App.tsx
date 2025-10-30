import { useEffect, useMemo, useState } from 'react';
import {
  fetchMyTasksMine,
  getSessionEmail,
  signInMagicLink,
  submitNote,
  todayISO,
  type ScheduleTask,
} from './lib/api';


// ✅ default を付けない（named）
function Login({ onConfirmed }: { onConfirmed: () => void | Promise<void> }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await signInMagicLink(email);
      alert('メールのマジックリンクを開いてから「ログイン済みを確認」を押してください。');
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
      <p style={{ color: '#666' }}>※RLS有効化後は、自分のメールに紐づく予定だけが表示されます。</p>
    </div>
  );
}

// ✅ default を付けない（named）
function TaskRow({ t, onOpen }: { t: ScheduleTask; onOpen: (t: ScheduleTask) => void }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, margin: '10px 0' }}>
      <b>{t.client_name}</b> <span style={{ color: '#666' }}>{t.start_time}〜{t.end_time}</span>
      <div style={{ color: '#666' }}>{t.destination || ''}</div>
      <button onClick={() => onOpen(t)} style={{ marginTop: 8, padding: '8px 12px' }}>
        記録を入力
      </button>
    </div>
  );
}

// ✅ ここでは default を付けず定義し、最後にまとめて default export します
function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ScheduleTask | null>(null);
  const dateISO = useMemo(() => todayISO(), []);

  const confirmLogin = async () => {
    const e = await getSessionEmail();
    setEmail(e);
    return e;
  };

  const load = async () => {
  setLoading(true);
  try {
    // ログイン中のメールを取得
    const me = await getSessionEmail();
    setEmail(me);

    // 自分のメールに紐づく予定だけ取得
    const list = await fetchMyTasksMine(me || undefined);
    setTasks(list);
  } catch (e: any) {
    alert(e.message || '取得に失敗しました');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  (async () => {
    const e = await confirmLogin();
    if (e) await load();
  })();
}, []);

  if (!email) {
    // async を渡してもOK（Login 側の型が Promise<void> を許容）
    return <Login onConfirmed={async () => { const ok = await confirmLogin(); if (ok) load(); }} />;
  }

  return (
    <div style={{ maxWidth: 560, margin: '16px auto', padding: '12px' }}>
      <h2>サービス記録（{dateISO}）</h2>
      <div style={{ color: '#666' }}>ログイン: {email}</div>
      <button onClick={load} style={{ margin: '8px 0', padding: '6px 10px' }}>再読み込み</button>

      {loading && <p>読み込み中…</p>}
      {!loading && tasks.length === 0 && <p>本日の予定はありません。</p>}
      {!loading && tasks.map((t) => <TaskRow key={t.id} t={t} onOpen={setEditing} />)}

      {editing && <QuickEditor task={editing} onClose={()=>{ setEditing(null); load(); }} />}
    </div>
  );
}

function QuickEditor({ task, onClose }: { task: ScheduleTask; onClose: () => void }) {
  const [memo, setMemo] = useState('');   // 実績メモのみ
  const [busy, setBusy] = useState(false);

  // ワンタップで入れられる短文（必要に応じて編集）
  const presets = [
    '安全に移動を完了。体調に問題なし。',
    '施設内で落ち着いて過ごされた。',
    'コミュニケーション良好。特記事項なし。',
    '支援中、不安定な場面あり。見守り強化。'
  ];

  const send = async () => {
    if (!memo.trim()) { alert('実績メモを入力してください'); return; }
    setBusy(true);
    try {
      // answers には最小限だけ渡す（他は task から再構成する）
      const answers = { actual: memo.trim() };
      await submitNote(task.id, answers);     // ← ここで Edge Function が走って拡張/整形
      alert('送信しました。ありがとうございます！');
      onClose();
    } catch (e:any) {
      alert(e.message || '送信に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.35)'}}>
      <div style={{background:'#fff', maxWidth:560, margin:'40px auto', padding:16, borderRadius:12}}>
        <h3>
          {task.client_name} / {task.task_date} / {task.start_time}〜{task.end_time}
        </h3>
        <div style={{color:'#666', marginBottom:8}}>予定：{task.destination || '—'}</div>

        <label>実績メモ（短くOK）</label>
        <textarea rows={4} value={memo} onChange={e=>setMemo(e.target.value)} style={{width:'100%'}} />

        <div style={{margin:'8px 0'}}>
          {presets.map((p,i)=>(
            <button key={i}
              onClick={()=>setMemo(m=> m ? m+' '+p : p)}
              style={{padding:'6px 10px', borderRadius:20, border:'1px solid #ddd', marginRight:8, marginBottom:8}}>
              {p}
            </button>
          ))}
        </div>

        <div style={{display:'flex', gap:8, marginTop:12}}>
          <button onClick={send} disabled={busy}
            style={{padding:'10px 14px', background:'#16a34a', color:'#fff', border:0, borderRadius:8}}>
            送 信
          </button>
          <button onClick={onClose} style={{padding:'10px 14px'}}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
// ✅ default export は App だけ（重複禁止）
export default App;

