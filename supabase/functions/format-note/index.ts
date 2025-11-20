import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const VER = "conn-test v1";

// 予約シークレット（Edge Runtime に元から用意されてる）
const PROJECT_URL      = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON    = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify({ ver: VER, ...((body as any) ?? {}) }), {
    status, headers: { "Content-Type": "application/json", ...corsHeaders }
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  // --- 診断モード（?diag=1）---
  if (url.searchParams.get("diag") === "1") {
    const looksJWT = (s: string) => s.split(".").length === 3;
    return json({
      env: {
        SUPABASE_URL: !!PROJECT_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!SERVICE_ROLE_KEY,
        SUPABASE_ANON_KEY: !!SUPABASE_ANON,
      },
      checks: {
        projectUrlOk: /^https:\/\/.+\.supabase\.co$/.test(PROJECT_URL),
        serviceRoleFormatOk: looksJWT(SERVICE_ROLE_KEY),
        serviceRoleLen: SERVICE_ROLE_KEY.length,
      },
      ok: "diag"
    });
  }

  // --- note_id を ?note_id か Body(JSON) から拾う ---
  let note_id = url.searchParams.get("note_id");
  if (!note_id) {
    const raw = await req.text();
    if (raw && raw.trim()) {
      try {
        const data = JSON.parse(raw);
        if (typeof data?.note_id === "string") note_id = data.note_id;
      } catch (_) {/* JSONでなければ無視 */}
    }
  }
  if (!note_id) return json({ error: "note_id is required (in body JSON or as ?note_id=...)" }, 400);

  if (!PROJECT_URL)      return json({ error: "SUPABASE_URL missing" }, 500);
  if (!SERVICE_ROLE_KEY) return json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" }, 500);

  // apikey は anon、認可は service_role
  const adminHeaders = {
    apikey: SUPABASE_ANON || SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    // 1) JOIN 取得
    const r1 = await fetch(
      `${PROJECT_URL}/rest/v1/service_notes?select=*,schedule_tasks(*)&id=eq.${note_id}`,
      { headers: adminHeaders }
    );
    if (!r1.ok) return json({ step: "select note", status: r1.status, error: await r1.text() }, r1.status);

    const rows = await r1.json();
    if (!rows?.length) return json({ error: "note not found", note_id }, 404);

    const row = rows[0];
    const t   = row.schedule_tasks;

    // 2) 読み取りのみ（?dry=1）
    if (url.searchParams.get("dry") === "1") {
      return json({ ok: true, mode: "dry", note_id, task_joined: !!t,
        snapshot: { task_date: t?.task_date, client: t?.client_name } });
    }

    // 3) 更新テスト（固定文を書き込む）
    const testText = `【接続テストOK】${new Date().toISOString()}  client=${t?.client_name ?? "?"}`;
    const r2 = await fetch(`${PROJECT_URL}/rest/v1/service_notes?id=eq.${note_id}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ note_text: testText }),
    });
    if (!r2.ok) return json({ step: "patch note_text", status: r2.status, error: await r2.text() }, r2.status);

    return json({ ok: true, mode: "updated", note_id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

