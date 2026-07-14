import React, { useEffect, useState } from 'react';
import type { AIProviderConfig, AIProviderType } from '../../shared/types';
import { useSettings } from '../hooks/useSettings';

const PROVIDERS: { value: AIProviderType; label: string }[] = [
  { value: 'builtin', label: 'Built-in AI (Chrome)' },
  { value: 'vertex', label: 'Vertex AI (Claude)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI' },
];

export function Settings() {
  const { config, save } = useSettings();
  const [draft, setDraft] = useState<AIProviderConfig>(config);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(config); }, [config]);

  async function handleSave() {
    await save(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function onProviderChange(provider: AIProviderType) {
    setDraft({ provider, apiKey: undefined, model: undefined, projectId: undefined, region: undefined });
  }

  const isVertex = draft.provider === 'vertex';
  const needsKey = draft.provider !== 'builtin';

  return (
    <div style={{ padding: '12px 16px', overflowY: 'auto', maxHeight: 440 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#111827' }}>
        AI Provider
      </h3>

      <label style={labelStyle}>
        Provider
        <select
          value={draft.provider}
          onChange={(e) => onProviderChange(e.target.value as AIProviderType)}
          style={inputStyle}
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </label>

      {isVertex && (
        <>
          <label style={labelStyle}>
            Project ID
            <input
              type="text"
              value={draft.projectId ?? ''}
              onChange={(e) => setDraft({ ...draft, projectId: e.target.value || undefined })}
              placeholder="my-gcp-project-id"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Region <span style={{ color: '#9ca3af' }}>(default: us-east5)</span>
            <input
              type="text"
              value={draft.region ?? ''}
              onChange={(e) => setDraft({ ...draft, region: e.target.value || undefined })}
              placeholder="us-east5"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Model <span style={{ color: '#9ca3af' }}>(default: claude-sonnet-4-5)</span>
            <input
              type="text"
              value={draft.model ?? ''}
              onChange={(e) => setDraft({ ...draft, model: e.target.value || undefined })}
              placeholder="claude-sonnet-4-5"
              style={inputStyle}
            />
          </label>

          <div style={{ marginBottom: 10, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, color: '#166534', lineHeight: 1.5 }}>
            ✓ Tokens are fetched automatically via the local gcloud native host.<br />
            Run <strong>native-host/install.ps1</strong> once if you haven&apos;t already.
          </div>
        </>
      )}

      {!isVertex && needsKey && (
        <>
          <label style={labelStyle}>
            API Key
            <input
              type="password"
              value={draft.apiKey ?? ''}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value || undefined })}
              placeholder="sk-…"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Model <span style={{ color: '#9ca3af' }}>(optional)</span>
            <input
              type="text"
              value={draft.model ?? ''}
              onChange={(e) => setDraft({ ...draft, model: e.target.value || undefined })}
              placeholder="leave blank for default"
              style={inputStyle}
            />
          </label>
        </>
      )}

      <button onClick={handleSave} style={btnStyle}>
        {saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 10,
  fontSize: 12,
  color: '#374151',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  padding: '5px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 12,
  color: '#111827',
  background: '#fff',
};

const btnStyle: React.CSSProperties = {
  marginTop: 4,
  width: '100%',
  padding: '7px 0',
  background: '#1d4ed8',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
