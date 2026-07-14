import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../shared/messages';
import type { InspectorState } from '../../shared/types';

interface Props {
  tabState: InspectorState;
}

export function AgentChat({ tabState }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError(null);

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AGENT_CHAT',
        tabId: tabState.tabId,
        messages: next,
      }) as { reply: string; error?: string };

      if (response.error) {
        setError(response.error);
      } else {
        setMessages([...next, { role: 'assistant', content: response.reply }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const noTools = tabState.status === 'complete' && tabState.tools.length === 0;
  const notReady = tabState.status !== 'complete';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
      {/* Context bar */}
      <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
        {notReady
          ? `⚠ Analysis ${tabState.status} — chat available once tools are registered`
          : noTools
          ? '⚠ No tools on this page — chat will answer questions but cannot interact'
          : `${tabState.tools.length} tool${tabState.tools.length !== 1 ? 's' : ''} available`}
      </div>

      {/* Message history */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
            <p style={{ margin: '0 0 4px' }}>Ask Claude to interact with this page.</p>
            {tabState.tools.length > 0 && tabState.tools[0] && (
              <p style={{ margin: 0 }}>
                e.g. <em>&ldquo;Use the {tabState.tools[0].name} tool&rdquo;</em>
              </p>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? '#1d4ed8' : '#f3f4f6',
              color: m.role === 'user' ? '#fff' : '#111827',
              borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '7px 11px',
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', color: '#6b7280', fontSize: 12, fontStyle: 'italic' }}>
            Claude is thinking…
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#dc2626' }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message Claude…"
          disabled={loading}
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '6px 12px',
            background: loading || !input.trim() ? '#e5e7eb' : '#1d4ed8',
            color: loading || !input.trim() ? '#9ca3af' : '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: loading || !input.trim() ? 'default' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
