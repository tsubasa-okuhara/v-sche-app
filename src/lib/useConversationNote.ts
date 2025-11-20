import { useCallback, useMemo, useState } from 'react';
import { parseServiceNoteStep } from './api';
import {
  serviceNoteSteps,
  type ConversationStep,
  // StepId は今のところ使っていないので import しない
  // type StepId,
} from './conversationSteps';
import {
  cloneServiceNoteFields,
  type ServiceNoteFields,
} from './serviceNoteSchema';

export type HistoryMessage = { from: 'system' | 'user'; text: string };

type Options = {
  steps?: ConversationStep[];
};

const formatPrompt = (step: ConversationStep | undefined) => {
  if (!step) return '';
  return step.hint ? `${step.prompt}\n${step.hint}` : step.prompt;
};

export function useConversationNote(
  initialFields: ServiceNoteFields,
  options?: Options,
) {
  const steps = options?.steps ?? serviceNoteSteps;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentFields, setCurrentFields] = useState<ServiceNoteFields>(() =>
    cloneServiceNoteFields(initialFields),
  );
  const [summary, setSummary] = useState('');
  const [history, setHistory] = useState<HistoryMessage[]>(() =>
    steps[0] ? [{ from: 'system', text: formatPrompt(steps[0]) }] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStep = steps[currentStepIndex];
  const isFinished = currentStepIndex >= steps.length;

  const reset = useCallback(
    (nextFields?: ServiceNoteFields) => {
      setCurrentFields(cloneServiceNoteFields(nextFields ?? initialFields));
      setCurrentStepIndex(0);
      setHistory(
        steps[0] ? [{ from: 'system', text: formatPrompt(steps[0]) }] : [],
      );
      setSummary('');
      setError(null);
    },
    [initialFields, steps],
  );

  const sendAnswer = useCallback(
    async (answer: string) => {
      if (loading || isFinished) return;
      const step = steps[currentStepIndex];
      if (!step) return;

      const trimmed = answer.trim();
      if (!trimmed) return;

      setHistory((prev) => [...prev, { from: 'user', text: trimmed }]);
      setLoading(true);
      setError(null);

      try {
        // Edge Function: { fields, summary } を返す
        const result = await parseServiceNoteStep(step.id, trimmed, currentFields);

        setCurrentFields(cloneServiceNoteFields(result.fields));
        setSummary(result.summary ?? '');

        const nextIndex = currentStepIndex + 1;
        const additions: HistoryMessage[] = [
          { from: 'system', text: '入力を反映しました。' },
        ];

        if (nextIndex < steps.length) {
          additions.push({
            from: 'system',
            text: formatPrompt(steps[nextIndex]),
          });
        } else {
          additions.push({
            from: 'system',
            text:
              '会話モードは終了しました。この内容で記録を作成してください。',
          });
        }

        setHistory((prev) => [...prev, ...additions]);
        setCurrentStepIndex(nextIndex);
      } catch (e: any) {
        const msg = e?.message ?? '解析に失敗しました';
        setError(msg);
        setHistory((prev) => [
          ...prev,
          {
            from: 'system',
            text: `⚠️ ${msg}。もう一度お試しください。`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [currentFields, currentStepIndex, isFinished, loading, steps],
  );

  const progress = useMemo(
    () => ({
      total: steps.length,
      current: Math.min(currentStepIndex + 1, steps.length),
    }),
    [currentStepIndex, steps.length],
  );

  return {
    currentFields,
    summary,
    history,
    loading,
    error,
    currentStep,
    currentStepIndex,
    steps,
    isFinished,
    progress,
    sendAnswer,
    reset,
  };
}