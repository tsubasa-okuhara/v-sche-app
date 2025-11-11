export type NoteFormState = {
  condition: string[];
  toilet: string[];
  mood: string;
  mealFood: string;
  mealWater: string;
  medication: string;
  interaction: string;
  memo: string;
  destination: string;
};

export type StoredAnswers = {
  actual?: string;
  form?: Partial<NoteFormState>;
};

export const CONDITION_OPTIONS = [
  { id: 'calm', label: '落ち着いていた' },
  { id: 'slightly-unstable', label: '少し不安定だった' },
  { id: 'agitated', label: '落ち着いていなかった（不穏・怒り・涙など）' },
  { id: 'seizure', label: '発作があった' },
  { id: 'no-seizure', label: '発作はなかった' },
  { id: 'condition-changed', label: '体調に変化あり（頭痛・腹痛・発熱など）' },
  { id: 'condition-unchanged', label: '体調に変化なし' },
] as const;

export const TOILET_OPTIONS = [
  { id: 'urination', label: 'トイレに行った（排尿あり）' },
  { id: 'defecation', label: 'トイレに行った（排便あり）' },
  { id: 'both', label: 'トイレに行った（排尿・排便あり）' },
  { id: 'no-toilet', label: 'トイレに行かなかった' },
  { id: 'diaper', label: 'おむつ交換あり' },
  { id: 'assist', label: 'トイレ介助あり／自立' },
] as const;

export const MOOD_OPTIONS = [
  { id: 'sunny', label: '☀️ 明るい' },
  { id: 'cloudy-sun', label: '🌤 普通' },
  { id: 'cloudy', label: '☁️ 少し沈み' },
  { id: 'rainy', label: '🌧 不機嫌' },
] as const;

export const MEAL_FOOD_OPTIONS = [
  { id: 'all', label: '完食' },
  { id: 'half', label: '半分' },
  { id: 'none', label: '食欲なし' },
] as const;

export const MEAL_WATER_OPTIONS = [
  { id: 'enough', label: '十分' },
  { id: 'lack', label: '不足' },
] as const;

export const MEDICATION_OPTIONS = [
  { id: 'taken', label: '内服した' },
  { id: 'forgot', label: '忘れた' },
  { id: 'refused', label: '一部拒否' },
] as const;

export const INTERACTION_OPTIONS = [
  { id: 'had', label: 'あった' },
  { id: 'none', label: 'なかった' },
] as const;

export const DEFAULT_NOTE_FORM: NoteFormState = {
  condition: [],
  toilet: [],
  mood: '',
  mealFood: '',
  mealWater: '',
  medication: '',
  interaction: '',
  memo: '',
  destination: '',
};

export function createDefaultFormState(): NoteFormState {
  return {
    condition: [],
    toilet: [],
    mood: '',
    mealFood: '',
    mealWater: '',
    medication: '',
    interaction: '',
    memo: '',
    destination: '',
  };
}

const optionMap = new Map<string, string>(
  [
    ...CONDITION_OPTIONS,
    ...TOILET_OPTIONS,
    ...MOOD_OPTIONS,
    ...MEAL_FOOD_OPTIONS,
    ...MEAL_WATER_OPTIONS,
    ...MEDICATION_OPTIONS,
    ...INTERACTION_OPTIONS,
  ].map(({ id, label }) => [id, label])
);

export function restoreFormState(raw?: StoredAnswers | null, fallback?: { destination?: string }): NoteFormState {
  if (!raw?.form) {
    return {
      ...DEFAULT_NOTE_FORM,
      destination: applyExpressionRules(fallback?.destination || ''),
    };
  }
  return {
    condition: Array.isArray(raw.form.condition) ? raw.form.condition.filter(isKnownCondition) : [],
    toilet: Array.isArray(raw.form.toilet) ? raw.form.toilet.filter(isKnownToilet) : [],
    mood: isKnown(MOOD_OPTIONS, raw.form.mood) ? raw.form.mood as string : '',
    mealFood: isKnown(MEAL_FOOD_OPTIONS, raw.form.mealFood) ? raw.form.mealFood as string : '',
    mealWater: isKnown(MEAL_WATER_OPTIONS, raw.form.mealWater) ? raw.form.mealWater as string : '',
    medication: isKnown(MEDICATION_OPTIONS, raw.form.medication) ? raw.form.medication as string : '',
    interaction: isKnown(INTERACTION_OPTIONS, raw.form.interaction) ? raw.form.interaction as string : '',
    memo: typeof raw.form.memo === 'string' ? raw.form.memo : '',
    destination: applyExpressionRules(
      typeof raw.form.destination === 'string' && raw.form.destination.trim()
        ? raw.form.destination
        : fallback?.destination || ''
    ),
  };
}

function isKnown<T extends readonly { id: string }[]>(options: T, value: unknown): value is string {
  return typeof value === 'string' && options.some(o => o.id === value);
}

function isKnownCondition(value: unknown): value is string {
  return typeof value === 'string' && CONDITION_OPTIONS.some(o => o.id === value);
}

function isKnownToilet(value: unknown): value is string {
  return typeof value === 'string' && TOILET_OPTIONS.some(o => o.id === value);
}

export function applyExpressionRules(text: string): string {
  let result = text || '';
  // 車椅子、自転車など誤変換したくない語を退避
  const placeholders: Array<{ key: string; value: string }> = [];

  const protect = (pattern: RegExp) => {
    result = result.replace(pattern, (match) => {
      const token = `__KEEP_${placeholders.length}__`;
      placeholders.push({ key: token, value: match });
      return token;
    });
  };

  protect(/車椅子/g);
  protect(/自転車/g);
  protect(/電車/g);
  protect(/バス/g);

  // 車両 → バス
  result = result.replace(/車両/g, 'バス');
  // 単体の「車」→ 電車（上で退避した語は影響しない）
  result = result.replace(/車/g, '電車');

  // 「公園」と「遊具」が同じ文に出た場合は散歩に統一
  result = result.replace(/公園[^。！？\n]{0,20}遊具[^。！？\n]*/g, '公園を散歩した');

  // 退避した語を戻す
  for (const { key, value } of placeholders) {
    result = result.replace(new RegExp(key, 'g'), value);
  }
  return result;
}

export function buildActualText(form: NoteFormState): string {
  const cond = form.condition.map(id => optionMap.get(id) ?? id);
  const toilet = form.toilet.map(id => optionMap.get(id) ?? id);
  const mood = optionMap.get(form.mood) ?? '';
  const food = optionMap.get(form.mealFood) ?? '';
  const water = optionMap.get(form.mealWater) ?? '';
  const medication = optionMap.get(form.medication) ?? '';
  const interaction = optionMap.get(form.interaction) ?? '';
  const memo = applyExpressionRules(form.memo?.trim() ?? '');
  const destination = applyExpressionRules(form.destination?.trim() ?? '');

  const section = (title: string, content: string | string[]) => {
    const body = Array.isArray(content)
      ? (content.length ? content.join('／') : '特記なし')
      : (content || '特記なし');
    return `${title}：${body}`;
  };

  const lines = [
    '【ルール】車・車両などの表現は電車やバスに言い換え、公園の遊具という記述は公園を散歩した等に変更してください。',
    section('行き先', destination || '特記なし'),
    '① その時の状態・様子',
    `　${cond.length ? cond.join('、') : '特記なし'}`,
    '② トイレ・排泄状況',
    `　${toilet.length ? toilet.join('、') : '特記なし'}`,
    section('気分・表情', mood),
    section('食事・水分摂取', [
      food ? `食事：${food}` : '食事：特記なし',
      water ? `水分：${water}` : '水分：特記なし',
    ]),
    section('服薬', medication),
    section('家族・他職員との交流', interaction),
    `実績メモ（短くてOK）：${memo || '特記なし'}`,
  ];

  return lines.join('\n');
}

export function serializeAnswers(form: NoteFormState) {
  return {
    actual: buildActualText(form),
    form,
  };
}

export function hasFormContent(form: NoteFormState): boolean {
  if (form.condition.length > 0 || form.toilet.length > 0) return true;
  if (
    form.mood ||
    form.mealFood ||
    form.mealWater ||
    form.medication ||
    form.interaction ||
    (form.destination && form.destination.trim())
  ) return true;
  return Boolean(form.memo && form.memo.trim());
}
