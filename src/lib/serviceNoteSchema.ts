import { applyExpressionRules } from './noteForm';
import type { NoteFormState } from './noteForm';

export type ConditionOptionId =
  | 'calm'
  | 'slightly-unstable'
  | 'agitated'
  | 'seizure'
  | 'no-seizure'
  | 'condition-changed'
  | 'condition-unchanged';

export type ToiletOptionId =
  | 'urination'
  | 'defecation'
  | 'both'
  | 'no-toilet'
  | 'diaper'
  | 'assist';

export type MoodOptionId = 'sunny' | 'cloudy-sun' | 'cloudy' | 'rainy';
export type MealFoodOptionId = 'all' | 'half' | 'none';
export type MealWaterOptionId = 'enough' | 'lack';
export type MedicationOptionId = 'taken' | 'forgot' | 'refused';
export type InteractionOptionId = 'had' | 'none';

export type ServiceNoteFields = {
  destination: string;
  condition: Record<ConditionOptionId, boolean>;
  toilet: Record<ToiletOptionId, boolean>;
  mood: MoodOptionId | null;
  mealFood: MealFoodOptionId | null;
  mealWater: MealWaterOptionId | null;
  medication: MedicationOptionId | null;
  interaction: InteractionOptionId | null;
  memo: string;
};

export function createEmptyServiceNoteFields(): ServiceNoteFields {
  return {
    destination: '',
    condition: {
      calm: false,
      'slightly-unstable': false,
      agitated: false,
      seizure: false,
      'no-seizure': false,
      'condition-changed': false,
      'condition-unchanged': false,
    },
    toilet: {
      urination: false,
      defecation: false,
      both: false,
      'no-toilet': false,
      diaper: false,
      assist: false,
    },
    mood: null,
    mealFood: null,
    mealWater: null,
    medication: null,
    interaction: null,
    memo: '',
  };
}

export function serviceNoteFieldsFromNoteForm(form: NoteFormState): ServiceNoteFields {
  const next = createEmptyServiceNoteFields();
  for (const id of form.condition) {
    if (id in next.condition) {
      next.condition[id as ConditionOptionId] = true;
    }
  }
  for (const id of form.toilet) {
    if (id in next.toilet) {
      next.toilet[id as ToiletOptionId] = true;
    }
  }
  next.mood = form.mood ? (form.mood as MoodOptionId) : null;
  next.mealFood = form.mealFood ? (form.mealFood as MealFoodOptionId) : null;
  next.mealWater = form.mealWater ? (form.mealWater as MealWaterOptionId) : null;
  next.medication = form.medication ? (form.medication as MedicationOptionId) : null;
  next.interaction = form.interaction ? (form.interaction as InteractionOptionId) : null;
  next.memo = form.memo || '';
  next.destination = form.destination || '';
  return normalizeServiceNoteFields(next);
}

export function serviceNoteFieldsToNoteForm(fields: ServiceNoteFields): NoteFormState {
  const form: NoteFormState = {
    condition: [],
    toilet: [],
    mood: fields.mood ?? '',
    mealFood: fields.mealFood ?? '',
    mealWater: fields.mealWater ?? '',
    medication: fields.medication ?? '',
    interaction: fields.interaction ?? '',
    memo: fields.memo,
    destination: fields.destination,
  };

  for (const [key, value] of Object.entries(fields.condition)) {
    if (value) form.condition.push(key as ConditionOptionId);
  }
  for (const [key, value] of Object.entries(fields.toilet)) {
    if (value) form.toilet.push(key as ToiletOptionId);
  }
  return form;
}

export function cloneServiceNoteFields(fields: ServiceNoteFields): ServiceNoteFields {
  return normalizeServiceNoteFields(fields);
}

export function normalizeServiceNoteFields(fields: ServiceNoteFields): ServiceNoteFields {
  const base = createEmptyServiceNoteFields();
  const condition = fields.condition ?? {};
  const toilet = fields.toilet ?? {};

  (Object.keys(base.condition) as ConditionOptionId[]).forEach((key) => {
    base.condition[key] = Boolean((condition as Record<string, unknown>)[key]);
  });

  (Object.keys(base.toilet) as ToiletOptionId[]).forEach((key) => {
    base.toilet[key] = Boolean((toilet as Record<string, unknown>)[key]);
  });

  base.mood = (fields.mood ?? null) as MoodOptionId | null;
  base.mealFood = (fields.mealFood ?? null) as MealFoodOptionId | null;
  base.mealWater = (fields.mealWater ?? null) as MealWaterOptionId | null;
  base.medication = (fields.medication ?? null) as MedicationOptionId | null;
  base.interaction = (fields.interaction ?? null) as InteractionOptionId | null;
  base.memo = applyExpressionRules((fields.memo ?? '').toString());
  base.destination = applyExpressionRules((fields.destination ?? '').toString());
  return base;
}
