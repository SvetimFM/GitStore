import { useState, useEffect } from 'react';
import { api, type App, type AppEnvVar } from '../api/client';

interface EnvRow {
  key: string;
  value: string;
  isSecret: boolean;
}

interface EnvConfigPanelProps {
  app: App;
  onSave: () => void;
}

export function EnvConfigPanel({ app, onSave }: EnvConfigPanelProps) {
  const [rows, setRows] = useState<EnvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getEnv(app.id).then(({ vars }) => {
      const existing = new Map<string, AppEnvVar>();
      for (const v of vars) existing.set(v.key, v);

      const envRows: EnvRow[] = [];

      for (const key of app.envVarsRequired) {
        const stored = existing.get(key);
        envRows.push({
          key,
          value: stored?.value ?? '',
          isSecret: stored?.isSecret ?? false,
        });
        existing.delete(key);
      }

      for (const [, v] of existing) {
        envRows.push({
          key: v.key,
          value: v.value,
          isSecret: v.isSecret,
        });
      }

      setRows(envRows);
      setLoading(false);
    });
  }, [app.id, app.envVarsRequired]);

  const updateRow = (index: number, field: keyof EnvRow, value: string | boolean) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, { key: '', value: '', isSecret: false }]);
  };

  const removeRow = (index: number) => {
    const row = rows[index];
    if (app.envVarsRequired.includes(row.key)) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const secretVars: Record<string, string> = {};
      const plainVars: Record<string, string> = {};

      for (const row of rows) {
        if (!row.key.trim()) continue;
        if (row.isSecret) {
          secretVars[row.key] = row.value;
        } else {
          plainVars[row.key] = row.value;
        }
      }

      if (Object.keys(plainVars).length > 0) {
        await api.setEnv(app.id, plainVars, false);
      }
      if (Object.keys(secretVars).length > 0) {
        await api.setEnv(app.id, secretVars, true);
      }

      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm py-2">Loading environment...</p>;
  }

  return (
    <div>
      <h4 className="text-white font-medium text-sm mb-3">Environment Variables</h4>

      <div className="space-y-2">
        {rows.map((row, i) => {
          const isRequired = app.envVarsRequired.includes(row.key);
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={row.key}
                onChange={e => updateRow(i, 'key', e.target.value)}
                placeholder="KEY"
                disabled={isRequired}
                className="bg-white/5 border border-white/10 text-white text-xs px-2.5 py-1.5 rounded-lg w-36 disabled:opacity-60 focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
              />
              <span className="text-gray-600 text-xs">=</span>
              <input
                type={row.isSecret ? 'password' : 'text'}
                value={row.value}
                onChange={e => updateRow(i, 'value', e.target.value)}
                placeholder="value"
                className="bg-white/5 border border-white/10 text-white text-xs px-2.5 py-1.5 rounded-lg flex-1 focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
              />
              <label className="flex items-center gap-1.5 text-gray-500 text-xs shrink-0 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={row.isSecret}
                  onChange={e => updateRow(i, 'isSecret', e.target.checked)}
                  className="w-3 h-3 rounded accent-purple-500"
                />
                Secret
              </label>
              {!isRequired ? (
                <button
                  onClick={() => removeRow(i)}
                  className="text-gray-600 hover:text-red-400 transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/10"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              ) : (
                <span className="text-purple-400/60 text-[10px] shrink-0 w-6 text-center">req</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={addRow}
          className="px-3 py-1.5 text-xs bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
        >
          + Add Variable
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-400 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
