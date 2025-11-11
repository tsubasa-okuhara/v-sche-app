import {
  CONDITION_OPTIONS,
  INTERACTION_OPTIONS,
  MEAL_FOOD_OPTIONS,
  MEAL_WATER_OPTIONS,
  MEDICATION_OPTIONS,
  MOOD_OPTIONS,
  TOILET_OPTIONS,
  applyExpressionRules,
} from '../lib/noteForm';
import type { NoteFormState } from '../lib/noteForm';
import '../note-form.css';

type Props = {
  value: NoteFormState;
  onChange: (next: NoteFormState) => void;
  disabled?: boolean;
};

export function ServiceNoteForm({ value, onChange, disabled }: Props) {
  const update = <K extends keyof NoteFormState>(key: K, updater: (prev: NoteFormState[K]) => NoteFormState[K]) => {
    onChange({ ...value, [key]: updater(value[key]) });
  };

  const toggle = (key: keyof NoteFormState, id: string) => {
    update(key, (prev) => {
      const arr = Array.isArray(prev) ? prev.slice() : [];
      const idx = arr.indexOf(id);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(id);
      return arr as NoteFormState[typeof key];
    });
  };

  const radio = (key: keyof NoteFormState, id: string) => {
    onChange({ ...value, [key]: value[key] === id ? '' as NoteFormState[typeof key] : (id as NoteFormState[typeof key]) });
  };

  const renderCheckboxGroup = (title: string, key: keyof NoteFormState, options: readonly { id: string; label: string }[]) => (
    <section className="note-form-section">
      <h4>{title}</h4>
      <div className="note-form-options">
        {options.map((opt) => {
          const arr = Array.isArray(value[key]) ? (value[key] as string[]) : [];
          const checked = arr.includes(opt.id);
          return (
            <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(key, opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </section>
  );

  const renderRadioGroup = (title: string, key: keyof NoteFormState, options: readonly { id: string; label: string }[]) => (
    <section className="note-form-section">
      <h4>{title}</h4>
      <div className="note-form-options">
        {options.map((opt) => {
          const checked = value[key] === opt.id;
          return (
            <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
              <input
                type="radio"
                name={key as string}
                checked={checked}
                disabled={disabled}
                onChange={() => radio(key, opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="note-form">
      <section className="note-form-section">
        <h4>行き先</h4>
        <input
          type="text"
          value={value.destination}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, destination: applyExpressionRules(e.target.value) })}
          placeholder="例）自宅 → まごめ園"
        />
      </section>
      {renderCheckboxGroup('① その時の状態・様子', 'condition', CONDITION_OPTIONS)}
      {renderCheckboxGroup('② トイレ・排泄状況', 'toilet', TOILET_OPTIONS)}
      {renderRadioGroup('気分・表情', 'mood', MOOD_OPTIONS)}
      <section className="note-form-section">
        <h4>食事・水分摂取</h4>
        <div className="note-form-subgrid">
          <div>
            <div className="note-form-subtitle">食事</div>
            <div className="note-form-options">
              {MEAL_FOOD_OPTIONS.map((opt) => {
                const checked = value.mealFood === opt.id;
                return (
                  <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
                    <input
                      type="radio"
                      name="mealFood"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => radio('mealFood', opt.id)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div className="note-form-subtitle">水分摂取</div>
            <div className="note-form-options">
              {MEAL_WATER_OPTIONS.map((opt) => {
                const checked = value.mealWater === opt.id;
                return (
                  <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
                    <input
                      type="radio"
                      name="mealWater"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => radio('mealWater', opt.id)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {renderRadioGroup('服薬', 'medication', MEDICATION_OPTIONS)}
      {renderRadioGroup('家族・他職員との交流', 'interaction', INTERACTION_OPTIONS)}
      <section className="note-form-section">
        <h4>実績メモ（短くてOK）</h4>
        <textarea
          value={value.memo}
          disabled={disabled}
          rows={4}
          onChange={(e) => onChange({ ...value, memo: applyExpressionRules(e.target.value) })}
          placeholder="自由記述欄。必要な補足のみで大丈夫です。"
        />
      </section>
    </div>
  );
}

export default ServiceNoteForm;
