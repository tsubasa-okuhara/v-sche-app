// src/lib/serviceNoteFacts.ts
import type { ServiceNoteFields } from './serviceNoteSchema';

/**
 * ServiceNoteFields + sections から
 * 「事実だけの箇条書きテキスト」を生成する。
 *
 * この結果を super-endpoint に渡せば、
 * GPT はこの事実だけを整形する役割になる。
 */
export function buildFactsFromFields(fields: ServiceNoteFields): string {
  const lines: string[] = [];

  // ① その時の状態・様子
  if (fields.sections.condition) {
    const c = fields.condition;
    const parts: string[] = [];

    if (c.seizure) {
      parts.push('移動中に軽い発作があった');
    }
    if (c.agitated) {
      parts.push('興奮気味な場面があった');
    }
    if (c['slightly-unstable']) {
      parts.push('一時的に不安定な様子が見られた');
    }
    if (c.calm) {
      parts.push('全体として落ち着いた様子だった');
    }
    if (c['condition-changed']) {
      parts.push('いつもと比べて様子に変化があった');
    }
    if (c['condition-unchanged']) {
      parts.push('体調や様子に大きな変化はなかった');
    }

    if (parts.length > 0) {
      lines.push(`状態・様子: ${parts.join('／')}`);
    }
  }

  // ② トイレ・排泄
  if (fields.sections.toilet) {
    const t = fields.toilet;
    const parts: string[] = [];

    if (t.urination || t.both) {
      parts.push('排尿介助を行った');
    }
    if (t.defecation || t.both) {
      parts.push('排便介助を行った');
    }
    if (t['no-toilet']) {
      parts.push('トイレ誘導は行っていない');
    }
    if (t.diaper) {
      parts.push('おむつ交換を行った');
    }
    if (t.assist) {
      parts.push('トイレ動作の見守りや声かけを行った');
    }

    if (parts.length > 0) {
      lines.push(`トイレ・排泄: ${parts.join('／')}`);
    }
  }

  // ③ 気分・表情
  if (fields.sections.mood && fields.mood) {
    const m = fields.mood;
    let desc = '';

    if (m === 'sunny') {
      desc = '表情は明るく穏やかだった';
    } else if (m === 'cloudy-sun') {
      desc = 'おおむね穏やかだが、時折不安そうな様子もあった';
    } else if (m === 'cloudy') {
      desc = 'やや元気がない様子が見られた';
    } else if (m === 'rainy') {
      desc = '不安定な様子が見られ、こまめに声かけを行った';
    }

    if (desc) {
      lines.push(`気分・表情: ${desc}`);
    }
  }

  // ④ 食事・水分摂取（大枠が ON かつ値ありのときだけ）
  if (fields.sections.meal && (fields.mealFood || fields.mealWater)) {
    const parts: string[] = [];

    if (fields.mealFood === 'all') {
      parts.push('食事は全量摂取');
    } else if (fields.mealFood === 'half') {
      parts.push('食事は半量程度');
    } else if (fields.mealFood === 'none') {
      parts.push('食事量は少ない／摂取なし');
    }

    if (fields.mealWater === 'enough') {
      parts.push('水分摂取は十分');
    } else if (fields.mealWater === 'lack') {
      parts.push('水分摂取はやや不足気味');
    }

    if (parts.length > 0) {
      lines.push(`食事・水分: ${parts.join('／')}`);
    }
  }

  // ⑤ 服薬（大枠 ON かつ値ありのときだけ）
  if (fields.sections.medication && fields.medication) {
    let desc = '';
    if (fields.medication === 'taken') {
      desc = '服薬は指示どおり行えた';
    } else if (fields.medication === 'forgot') {
      desc = '服薬を忘れていたため確認と声かけを行った';
    } else if (fields.medication === 'refused') {
      desc = '服薬の拒否があり、状況を共有して様子を見ている';
    }

    if (desc) {
      lines.push(`服薬: ${desc}`);
    }
  }

  // ⑥ 家族・他職員からの報告（現状 familyReport はまだ fields に無いなら、後で拡張）

  // 共通メモ（あれば）
  if (fields.memo && fields.memo.trim()) {
    lines.push(`補足メモ: ${fields.memo.trim()}`);
  }

  // 1行も無ければ空文字を返す
  return lines.join('\n');
}