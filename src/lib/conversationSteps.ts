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
};

export const serviceNoteSteps: ConversationStep[] = [
  { id: 'destination', prompt: '行き先を教えてください。' },
  { id: 'condition', prompt: 'その時の状態は落ち着いていましたか？' },
  { id: 'toilet', prompt: 'トイレには行きましたか？排尿・排便はありましたか？' },
  { id: 'mood', prompt: '気分や表情はどうでしたか？' },
  { id: 'meal', prompt: '食事はどのくらい摂りましたか？' },
  { id: 'water', prompt: '水分はどのくらい摂りましたか？' },
  { id: 'medicine', prompt: 'お薬は内服できましたか？' },
  { id: 'family', prompt: 'ご家族や他職員との交流はありましたか？' },
  { id: 'memo', prompt: 'その他、気になったことがあれば教えてください。' },
];
