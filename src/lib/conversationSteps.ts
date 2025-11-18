export type StepId =
  | 'destination'
  | 'condition'
  | 'toilet'
  | 'mood'
  | 'meal'
  | 'water'
  | 'medicine'
  | 'family'
  | 'memo';

export type ConversationStep = {
  id: StepId;
  prompt: string;
  hint?: string;
};

export const serviceNoteSteps: ConversationStep[] = [
  {
    id: 'destination',
    prompt: '行き先を教えてください。',
    hint: '例: 自宅から〇〇園まで など',
  },
  {
    id: 'condition',
    prompt: 'その時の状態は落ち着いていましたか？',
    hint: '落ち着き/不穏/発作の有無など',
  },
  {
    id: 'toilet',
    prompt: 'トイレには行きましたか？排尿・排便はありましたか？',
    hint: '排尿・排便の有無、介助内容',
  },
  {
    id: 'mood',
    prompt: '気分や表情はどうでしたか？',
    hint: '晴れやか / 少し不安など簡潔に',
  },
  {
    id: 'meal',
    prompt: '食事はどのくらい摂りましたか？',
    hint: '完食 / 半分 / ほとんどなし など',
  },
  {
    id: 'water',
    prompt: '水分はどのくらい摂りましたか？',
    hint: '十分 / やや不足 など',
  },
  {
    id: 'medicine',
    prompt: 'お薬は内服できましたか？',
    hint: '服薬できた / 忘れた / 拒否 など',
  },
  {
    id: 'family',
    prompt: 'ご家族や他職員との交流はありましたか？',
    hint: '会話や対応の様子があれば',
  },
  {
    id: 'memo',
    prompt: 'その他、気になったことがあれば教えてください。',
    hint: '短くメモしたい内容があれば自由に',
  },
];
