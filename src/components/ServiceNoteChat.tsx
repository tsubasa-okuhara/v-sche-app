import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { parseServiceNoteStep } from '../lib/api';
import { serviceNoteSteps } from '../lib/conversationSteps';
import type { ServiceNoteFields } from '../lib/serviceNoteSchema';
import { cloneServiceNoteFields } from '../lib/serviceNoteSchema';

type HistoryMessage = { from: 'system' | 'user'; text: string };

type Props = {
  value: ServiceNoteFields;
  onChange: (next: ServiceNoteFields) => void;
};

export default function ServiceNoteChat({ value, onChange }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const conversationFinished = currentStepIndex >= serviceNoteSteps.length;

  useEffect(() => {
    setHistory([{ from: 'system', text: serviceNoteSteps[0].prompt }]);
    setCurrentStepIndex(0);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [history]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || conversationFinished) return;

    const step = serviceNoteSteps[currentStepIndex];
    if (!step) return;

    setHistory((prev) => [...prev, { from: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const updated = await parseServiceNoteStep(step.id, trimmed, value);
      onChange(cloneServiceNoteFields(updated));

      const nextIndex = currentStepIndex + 1;
      const additions: HistoryMessage[] = [
        { from: 'system', text: '入力を反映しました。' },
      ];
      if (nextIndex < serviceNoteSteps.length) {
        additions.push({ from: 'system', text: serviceNoteSteps[nextIndex].prompt });
      } else {
        additions.push({
          from: 'system',
          text: '会話モードは終了しました。この内容で記録を作成してください。',
        });
      }
      setHistory((prev) => [...prev, ...additions]);
      setCurrentStepIndex(nextIndex);
    } catch (error: any) {
      const message =
        error?.message ||
        '解析に失敗しました。もう一度入力するか、フォームに戻って修正してください。';
      setHistory((prev) => [
        ...prev,
        { from: 'system', text: `⚠️ ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#f9fafb',
      }}
    >
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {history.map((msg, idx) => {
          const isUser = msg.from === 'user';
          return (
            <div
              key={`${msg.from}-${idx}-${msg.text.slice(0, 8)}`}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                background: isUser ? '#2563eb' : '#fff',
                color: isUser ? '#fff' : '#1f2937',
                padding: '12px 14px',
                borderRadius: '16px',
                maxWidth: '85%',
                boxShadow: '0 1px 4px rgba(15, 23, 42, 0.12)',
                whiteSpace: 'pre-wrap',
                fontSize: 15,
                lineHeight: 1.6,
              }}
            >
              {msg.text}
            </div>
          );
        })}
        {conversationFinished && (
          <div
            style={{
              alignSelf: 'center',
              fontSize: 13,
              color: '#6b7280',
              marginTop: 8,
            }}
          >
            追加で修正したい場合はフォームで直接編集できます。
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          padding: '16px',
          borderTop: '1px solid #e5e7eb',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || conversationFinished}
          rows={4}
          placeholder={
            conversationFinished
              ? '全ての質問が完了しました。フォームで最終確認してください。'
              : 'ここに回答を入力してください。'
          }
          style={{
            width: '100%',
            resize: 'none',
            borderRadius: 12,
            border: '1px solid #d1d5db',
            padding: '12px',
            fontSize: 15,
            lineHeight: 1.6,
            background: conversationFinished ? '#f3f4f6' : '#fff',
          }}
        />
        <button
          type="submit"
          disabled={loading || conversationFinished || !input.trim()}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 999,
            border: 'none',
            background: loading ? '#9ca3af' : '#2563eb',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          {loading ? '解析中…' : conversationFinished ? '完了しました' : '送信'}
        </button>
      </form>
    </div>
  );
}
