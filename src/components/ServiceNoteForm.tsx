import { useState } from 'react';
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
  const [page, setPage] = useState<'big' | 'detail'>('big');

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
      {/* 1. 行き先（共通） */}
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

      {/* PAGE 1: 大枠レ点 */}
      {page === 'big' && (
        <>
          <section className="note-form-section">
            <h4>記録する項目（大枠）</h4>
            <div className="note-form-options">
              {/* ① その時の状態・様子 */}
              <label
                className={`note-form-chip${value.sections.condition ? ' checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={value.sections.condition}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      ...value,
                      sections: {
                        ...value.sections,
                        condition: !value.sections.condition,
                      },
                    })
                  }
                />
                <span>① その時の状態・様子</span>
              </label>

              {/* ② トイレ */}
              <label
                className={`note-form-chip${value.sections.toilet ? ' checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={value.sections.toilet}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      ...value,
                      sections: {
                        ...value.sections,
                        toilet: !value.sections.toilet,
                      },
                    })
                  }
                />
                <span>② トイレ・排泄状況</span>
              </label>

              {/* ③ 気分 */}
              <label className={`note-form-chip${value.sections.mood ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={value.sections.mood}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      ...value,
                      sections: {
                        ...value.sections,
                        mood: !value.sections.mood,
                      },
                    })
                  }
                />
                <span>③ 気分・表情</span>
              </label>

              {/* ④ 食事・水分 */}
              <label className={`note-form-chip${value.sections.meal ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={value.sections.meal}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      ...value,
                      sections: {
                        ...value.sections,
                        meal: !value.sections.meal,
                      },
                    })
                  }
                />
                <span>④ 食事・水分摂取</span>
              </label>

              {/* ⑤ 服薬 */}
              <label
                className={`note-form-chip${value.sections.medication ? ' checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={value.sections.medication}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      ...value,
                      sections: {
                        ...value.sections,
                        medication: !value.sections.medication,
                      },
                    })
                  }
                />
                <span>⑤ 服薬</span>
              </label>

              {/* ⑥ 家族・他職員からの報告 */}
              <label
                className={`note-form-chip${
                  value.sections.familyReport ? ' checked' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={value.sections.familyReport}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      ...value,
                      sections: {
                        ...value.sections,
                        familyReport: !value.sections.familyReport,
                      },
                    })
                  }
                />
                <span>⑥ 家族・他職員からの報告</span>
              </label>
            </div>
          </section>

          <section className="note-form-section">
            <button
              type="button"
              className="note-form-next"
              disabled={disabled}
              onClick={() => setPage('detail')}
            >
              次へ進む
            </button>
          </section>
        </>
      )}

      {/* PAGE 2: 小枠ページ */}
      {page === 'detail' && (
        <>
          {/* ① 状態 */}
          {value.sections.condition && (
            <section className="note-form-section">
              <h4>① その時の状態・様子</h4>
              <div className="note-form-options">
                {CONDITION_OPTIONS.map((opt) => {
                  const checked = Boolean(
                    value.condition[opt.id as keyof typeof value.condition],
                  );
                  return (
                    <label
                      key={opt.id}
                      className={`note-form-chip${checked ? ' checked' : ''}`}
                    >
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
          )}

          {/* ② トイレ */}
          {value.sections.toilet && (
            <section className="note-form-section">
              <h4>② トイレ・排泄状況</h4>
              <div className="note-form-options">
                {TOILET_OPTIONS.map((opt) => {
                  const checked = Boolean(
                    value.toilet[opt.id as keyof typeof value.toilet],
                  );
                  return (
                    <label
                      key={opt.id}
                      className={`note-form-chip${checked ? ' checked' : ''}`}
                    >
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
          )}

          {/* ③ 気分 */}
          {value.sections.mood && (
            <section className="note-form-section">
              <h4>③ 気分・表情</h4>
              <div className="note-form-options">
                {MOOD_OPTIONS.map((opt) => {
                  const checked = value.mood === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`note-form-chip${checked ? ' checked' : ''}`}
                    >
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
          )}

          {/* ④ 食事・水分 */}
          {value.sections.meal && (
            <section className="note-form-section">
              <h4>④ 食事・水分摂取</h4>
              <div className="note-form-subgrid">
                <div>
                  <div className="note-form-subtitle">食事</div>
                  <div className="note-form-options">
                    {MEAL_FOOD_OPTIONS.map((opt) => {
                      const checked = value.mealFood === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`note-form-chip${checked ? ' checked' : ''}`}
                        >
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
                        <label
                          key={opt.id}
                          className={`note-form-chip${checked ? ' checked' : ''}`}
                        >
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
          )}

          {/* ⑤ 服薬 */}
          {value.sections.medication && (
            <section className="note-form-section">
              <h4>⑤ 服薬</h4>
              <div className="note-form-options">
                {MEDICATION_OPTIONS.map((opt) => {
                  const checked = value.medication === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`note-form-chip${checked ? ' checked' : ''}`}
                    >
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
          )}

          {/* ⑥ 家族・他職員との交流 */}
          {value.sections.familyReport && (
            <section className="note-form-section">
              <h4>⑥ 家族・他職員との報告</h4>
              <div className="note-form-options">
                {INTERACTION_OPTIONS.map((opt) => {
                  const checked = value.interaction === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`note-form-chip${checked ? ' checked' : ''}`}
                    >
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
          )}

          {/* 実績メモ */}
          <section className="note-form-section">
            <h4>実績メモ（短くてOK）</h4>
            <textarea
              value={value.memo}
              disabled={disabled}
              rows={4}
              onChange={(e) =>
                onChange({ ...value, memo: applyExpressionRules(e.target.value) })
              }
              placeholder="自由記述欄。必要な補足のみで大丈夫です。"
            />
          </section>

          {/* 戻る */}
          <section className="note-form-section">
            <button
              type="button"
              className="note-form-back"
              disabled={disabled}
              onClick={() => setPage('big')}
            >
              戻る
            </button>
          </section>
        </>
      )}
    </div>
  );
}

export default ServiceNoteForm;