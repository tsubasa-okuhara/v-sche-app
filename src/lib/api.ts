import dayjs from 'dayjs';
import { supabase } from './supabase';

/* ========= 型 ========= */

export type ScheduleTask = {
  id: string;
  task_date: string;
  helper_name: string;
  helper_email: string | null;
  client_name: string;
  start_time: string;
  end_time: string;
  destination: string | null;
  status: string;
};

export type PendingNote = {
  id: string;                 // service_notes.id（note_id）
  task_id: string;            // 紐づく予定ID
  answers: any;               // 下書きメモ
  note_text: string | null;   // まだ空
  schedule_tasks: {
    task_date: string;
    helper_name: string;
    client_name: string;
    start_time: string;
    end_time: string;
    destination: string | null;
    helper_email: string | null;
  } | null;
};

export type ServiceRecord = {
  id: string;
  note_text: string;
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

/* ========= 共通ユーティリティ ========= */

export const todayISO = () => dayjs().format('YYYY-MM-DD');

export async function signInMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function getSessionEmail() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/* ========= 予定の取得 ========= */

export async function fetchMyTasks(dateISO: string) {
  const { data, error } = await supabase
    .from('schedule_tasks')
    .select('*')
    .eq('task_date', dateISO)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data || []) as ScheduleTask[];
}

export async function fetchMyTasksAll() {
  const { data, error } = await supabase
    .from('schedule_tasks')
    .select('*')
    .order('task_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data || []) as ScheduleTask[];
}

export async function fetchMyTasksMine(email?: string) {
  let q = supabase
    .from('schedule_tasks')
    .select('*')
    .order('task_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (email) q = q.eq('helper_email', email);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ScheduleTask[];
}

/** 自分の未入力タスクだけ（View: v_tasks_todo を使用） */
export async function fetchTasksTodoByEmail(email: string) {
  const { data, error } = await supabase
    .from('v_tasks_todo')
    .select('*')
    .eq('helper_email', email)
    .order('task_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** 自分のメールに紐づく schedule_tasks 全件（Viewを使わない版） */
export async function fetchTasksByEmail(email: string) {
  const { data, error } = await supabase
    .from('schedule_tasks')
    .select('*')
    .eq('helper_email', email)
    .order('task_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ========= service_notes（実績） ========= */

/** task_id で既存 note を探し、あれば answers を更新、無ければ作成して note_id を返す */
export async function upsertServiceNote(taskId: string, answers: any): Promise<string> {
  const { data: exist, error: e0 } = await supabase
    .from('service_notes')
    .select('id')
    .eq('task_id', taskId)
    .limit(1)
    .maybeSingle();
  if (e0) throw e0;

  if (exist?.id) {
    const { data, error } = await supabase
      .from('service_notes')
      .update({ answers })
      .eq('id', exist.id)
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  } else {
    const { data, error } = await supabase
      .from('service_notes')
      .insert([{ task_id: taskId, answers }])
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }
}

/** Edge Function を叩いて AI 整形を実行（note_textを書き込む） */
export async function runAiFormat(noteId: string) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-endpoint`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ note_id: noteId }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`AI format failed: ${res.status} ${t}`);
  }
  return await res.json(); // { ok:true, updated:true, ... }
}

/** 生成された note_text を取得（UI表示用） */
export async function fetchNoteText(noteId: string) {
  const { data, error } = await supabase
    .from('service_notes')
    .select('note_text')
    .eq('id', noteId)
    .single();
  if (error) throw error;
  return (data?.note_text ?? '') as string;
}

/** 予定のステータスを更新（submitted/done など） */
export async function updateTaskStatus(taskId: string, status: 'submitted' | 'done') {
  const { error } = await supabase
    .from('schedule_tasks')
    .update({ status })
    .eq('id', taskId);
  if (error) throw error;
}

/** 送信フロー（upsert → submitted → AI整形 → done） */
export async function submitNote(taskId: string, answers: any) {
  const noteId = await upsertServiceNote(taskId, answers);
  await updateTaskStatus(taskId, 'submitted');
  try {
    await runAiFormat(noteId);
    await updateTaskStatus(taskId, 'done');
  } catch (e) {
    console.error(e);
  }
  return noteId;
}

/** ログイン中の人の「未入力ノート（note_text が空）」を取得 */
// ① 未入力ノート一覧
export async function fetchMyPendingNotes(email?: string) {
  let q = supabase
    .from('service_notes')
    .select(`
      id, task_id, answers, note_text,
      schedule_tasks (
        task_date, helper_name, client_name, start_time, end_time, destination, helper_email
      )
    `)
    .or('note_text.is.null,note_text.eq.') // null or '' を未入力扱い
    .order('created_at', { ascending: false });

  if (email) q = q.eq('schedule_tasks.helper_email', email);

  const { data, error } = await q;
  if (error) throw error;

  // 👇 ここで schedule_tasks を必ず「オブジェクト or null」に正規化
  const normalized: PendingNote[] = (data || []).map((row: any) => ({
    ...row,
    schedule_tasks: Array.isArray(row.schedule_tasks)
      ? (row.schedule_tasks[0] ?? null)
      : row.schedule_tasks ?? null,
  }));

  return normalized;
}


/** note_id から直接更新 → AI整形実行 */
export async function submitNoteByNoteId(noteId: string, answers: any) {
  const { error } = await supabase
    .from('service_notes')
    .update({ answers })
    .eq('id', noteId);
  if (error) throw error;

  await runAiFormat(noteId);
  return noteId;
}

/** 自分の提出済みサービス記録を取得（note_text が入っているもの） */
export async function fetchMyRecords(email: string, from?: string, to?: string) {
  let q = supabase
    .from('service_notes')
    .select(`
      id, note_text, created_at,
      schedule_tasks (
        task_date, start_time, end_time, client_name, helper_name, destination, helper_email
      )
    `)
    .not('note_text', 'is', null)
    .neq('note_text', '');

  q = q
    .eq('schedule_tasks.helper_email', email)
    .order('schedule_tasks.task_date', { ascending: false })
    .order('schedule_tasks.start_time', { ascending: false });

  if (from) q = q.gte('schedule_tasks.task_date', from);
  if (to)   q = q.lte('schedule_tasks.task_date', to);

  const { data, error } = await q;
  if (error) throw error;

  // 👇 同じく正規化
  const normalized: ServiceRecord[] = (data || []).map((row: any) => ({
    ...row,
    schedule_tasks: Array.isArray(row.schedule_tasks)
      ? (row.schedule_tasks[0] ?? null)
      : row.schedule_tasks ?? null,
  }));

  return normalized;
}