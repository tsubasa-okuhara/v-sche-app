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
import type { ServiceNoteFields } from '../lib/serviceNoteSchema';
import '../note-form.css';

type Props = {
  value: ServiceNoteFields;
  onChange: (next: ServiceNoteFields) => void;
  disabled?: boolean;
};

export function ServiceNoteForm({ value, onChange, disabled }: Props) {
  const toggleCondition = (id: string) => {
    onChange({
      ...value,
      condition: {
        ...value.condition,
        [id]: !value.condition[id as keyof typeof value.condition],
      },
    });
  };

  const toggleToilet = (id: string) => {
    onChange({
      ...value,
      toilet: {
        ...value.toilet,
        [id]: !value.toilet[id as keyof typeof value.toilet],
      },
    });
  };

  const toggleRadio = (key: keyof ServiceNoteFields, id: string) => {
    const current = value[key];
    const nextValue = current === id ? null : (id as ServiceNoteFields[typeof key]);
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="note-form">
      <section className="note-form-section">
        <h4>行き先</h4>
        <input
          type="text"
          value={value.destination}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, destination: applyExpressionRules(e.target.value) })
          }
          placeholder="例）自宅 → まごめ園"
        />
      </section>

      <section className="note-form-section">
        <h4>① その時の状態・様子</h4>
        <div className="note-form-options">
          {CONDITION_OPTIONS.map((opt) => {
            const checked = Boolean(value.condition[opt.id as keyof typeof value.condition]);
            return (
              <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleCondition(opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="note-form-section">
        <h4>② トイレ・排泄状況</h4>
        <div className="note-form-options">
          {TOILET_OPTIONS.map((opt) => {
            const checked = Boolean(value.toilet[opt.id as keyof typeof value.toilet]);
            return (
              <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleToilet(opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="note-form-section">
        <h4>気分・表情</h4>
        <div className="note-form-options">
          {MOOD_OPTIONS.map((opt) => {
            const checked = value.mood === opt.id;
            return (
              <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
                <input
                  type="radio"
                  name="mood"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleRadio('mood', opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </section>

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
                      onChange={() => toggleRadio('mealFood', opt.id)}
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
                      onChange={() => toggleRadio('mealWater', opt.id)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="note-form-section">
        <h4>服薬</h4>
        <div className="note-form-options">
          {MEDICATION_OPTIONS.map((opt) => {
            const checked = value.medication === opt.id;
            return (
              <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
                <input
                  type="radio"
                  name="medication"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleRadio('medication', opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="note-form-section">
        <h4>家族・他職員との交流</h4>
        <div className="note-form-options">
          {INTERACTION_OPTIONS.map((opt) => {
            const checked = value.interaction === opt.id;
            return (
              <label key={opt.id} className={`note-form-chip${checked ? ' checked' : ''}`}>
                <input
                  type="radio"
                  name="interaction"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleRadio('interaction', opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </section>

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
