// src/components/ServiceNoteChat.tsx
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ServiceNoteFields } from '../lib/serviceNoteSchema';
import { cloneServiceNoteFields } from '../lib/serviceNoteSchema';
import { useConversationNote } from '../lib/useConversationNote';

type Props = {
  value: ServiceNoteFields;
  onChange: (next: ServiceNoteFields) => void;
  onComplete?: (result: { fields: ServiceNoteFields; summary: string }) => void;
  onClose?: () => void;
};

export default function ServiceNoteChat({ value, onChange, onComplete, onClose }: Props) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const {
    history,
    loading,
    isFinished,
    summary,
    currentFields,
    currentStep,
    sendAnswer,
  } = useConversationNote(value);

  // 履歴が更新されたらスクロールを一番下へ
  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [history]);

  // currentFields の内容は常に親フォームへ反映
  useEffect(() => {
    onChange(cloneServiceNoteFields(currentFields));
  }, [currentFields, onChange]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || isFinished) return;
    setInput('');
    await sendAnswer(trimmed);
  };

  const handleComplete = () => {
    if (!isFinished) return;
    onComplete?.({
      fields: cloneServiceNoteFields(currentFields),
      summary,
    });
    onClose?.();
  };

  const handleSubmit = (e: FormEvent) => {
    // Enter / submit を無効化（onClick だけで制御）
    e.preventDefault();
  };

  const renderPromptHint = () => {
    if (!currentStep || isFinished) return null;
    return (
      <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{currentStep.prompt}</div>
        {currentStep.hint && <div style={{ color: '#6b7280' }}>{currentStep.hint}</div>}
      </div>
    );
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
        {isFinished && (
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
        {summary && (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: '#ecfccb',
              color: '#3f6212',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>AI要約</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{summary}</div>
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
        {renderPromptHint()}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || isFinished}
          rows={4}
          placeholder={
            isFinished
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
            background: isFinished ? '#f3f4f6' : '#fff',
          }}
        />
        <button
          type="button"
          onClick={isFinished ? handleComplete : handleSend}
          disabled={loading || (!isFinished && !input.trim())}
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
          {loading ? '解析中…' : isFinished ? '完了しました' : '送信'}
        </button>
      </form>
    </div>
  );
}