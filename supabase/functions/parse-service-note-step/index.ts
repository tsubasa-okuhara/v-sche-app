import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ConditionKeys =
  | "calm"
  | "slightly-unstable"
  | "agitated"
  | "seizure"
  | "no-seizure"
  | "condition-changed"
  | "condition-unchanged";

type ToiletKeys =
  | "urination"
  | "defecation"
  | "both"
  | "no-toilet"
  | "diaper"
  | "assist";

type MoodKeys = "sunny" | "cloudy-sun" | "cloudy" | "rainy" | null;
type MealFoodKeys = "all" | "half" | "none" | null;
type MealWaterKeys = "enough" | "lack" | null;
type MedicationKeys = "taken" | "forgot" | "refused" | null;
type InteractionKeys = "had" | "none" | null;

type ServiceNoteFields = {
  destination: string;
  condition: Record<ConditionKeys, boolean>;
  toilet: Record<ToiletKeys, boolean>;
  mood: MoodKeys;
  mealFood: MealFoodKeys;
  mealWater: MealWaterKeys;
  medication: MedicationKeys;
  interaction: InteractionKeys;
  memo: string;
};

type StepId =
  | "destination"
  | "condition"
  | "toilet"
  | "mood"
  | "meal"
  | "water"
  | "medicine"
  | "family"
  | "memo";

type RequestPayload = {
  stepId: StepId;
  answer: string;
  current: ServiceNoteFields;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (body: unknown) =>
  new Response(JSON.stringify(body ?? {}), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const err = (message: string, status = 400, extra?: Record<string, unknown>) =>
  new Response(JSON.stringify({ error: message, ...(extra ?? {}) }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";

const SYSTEM_PROMPT = `
あなたは訪問介護のサービス実績記録を構造化するアシスタントです。
ServiceNoteFields 型の JSON を常に返してください。余計な文は不要です。

- destination: 文字列。入力に合わせて自然な表現にしてください（例「自宅→まごめ園」など）。
- condition/toilet: ブールフラグです。該当する内容のみ true に、他は false にしてください。複数同時に true でも構いません。
  - condition: calm, slightly-unstable, agitated, seizure, no-seizure, condition-changed, condition-unchanged
  - toilet: urination, defecation, both, no-toilet, diaper, assist
- mood, mealFood, mealWater, medication, interaction: 指定の選択肢から選んでください。該当がなければ null。
  - mood: sunny|cloudy-sun|cloudy|rainy
  - mealFood: all|half|none
  - mealWater: enough|lack
  - medication: taken|forgot|refused
  - interaction: had|none
- memo: 自由記述。短文で要点のみ。不要なら空文字列。

入力の answer を current に反映して、最終的な ServiceNoteFields 全体を返します。
特に condition/toilet ステップでは記述から複数フラグを的確に判断してください。
`;

function buildUserPrompt(payload: RequestPayload) {
  return JSON.stringify(
    {
      stepId: payload.stepId,
      answer: payload.answer,
      current: payload.current,
    },
    null,
    2,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return err("Method not allowed", 405);
  }

  let body: RequestPayload | null = null;
  try {
    body = await req.json();
  } catch (_) {
    return err("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object") {
    return err("Invalid payload", 400);
  }

  const { stepId, answer, current } = body;
  if (!stepId || typeof stepId !== "string") {
    return err("stepId is required");
  }
  if (!answer || typeof answer !== "string") {
    return err("answer is required");
  }
  if (!current || typeof current !== "object") {
    return err("current is required");
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? Deno.env.get("OPENAI_KEY");
  if (!OPENAI_API_KEY) {
    return err("OPENAI_API_KEY is not configured", 500);
  }

  const payload = {
    model: MODEL,
    response_format: { type: "json_object" },
    input: [
      {
        role: "system",
        content: [{ type: "text", text: SYSTEM_PROMPT.trim() }],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `現在のステップ: ${stepId}\n回答:\n${answer}\n\n現在のフォーム:\n${buildUserPrompt({
              stepId,
              answer,
              current,
            })}`,
          },
        ],
      },
    ],
  };

  try {
    const aiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return err("Failed to call OpenAI", aiRes.status, { detail: text });
    }

    const result = await aiRes.json();
    const output = Array.isArray(result?.output) ? result.output : [];
    const message = output.find((item: any) => item?.type === "message");
    const textContent = message?.content?.find((c: any) => c?.type === "text")?.text;
    if (!textContent || typeof textContent !== "string") {
      return err("OpenAI response did not contain text", 502, { raw: result });
    }

    let parsed: ServiceNoteFields | null = null;
    try {
      parsed = JSON.parse(textContent);
    } catch (parseError) {
      return err("Failed to parse JSON from OpenAI response", 502, {
        raw: textContent,
        parseError: String(parseError),
      });
    }

    return ok(parsed);
  } catch (e) {
    return err("Unexpected error", 500, { message: String(e) });
  }
});
