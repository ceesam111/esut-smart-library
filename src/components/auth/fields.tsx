import { useState, ReactNode } from 'react';

const GREEN = '#1A4731';

export function Field({
  label, required, children, hint,
}: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}

export function TextInput({
  value, onChange, placeholder, type = 'text', required, maxLength, mono, max,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; required?: boolean; maxLength?: number; mono?: boolean; max?: string;
}) {
  return (
    <input
      className={`input${mono ? ' font-mono' : ''}${type === 'date' ? ' cursor-pointer' : ''}`}
      type={type}
      value={value}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => {
        if (type === 'date' && 'showPicker' in HTMLInputElement.prototype) {
          try {
            (e.target as HTMLInputElement).showPicker();
          } catch (err) {
            // Ignore error if picker is already showing or not supported
          }
        }
      }}
    />
  );
}

export function SelectInput({
  value, onChange, options, required, placeholder,
}: {
  value: string; onChange: (v: string) => void; options: string[];
  required?: boolean; placeholder?: string;
}) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{placeholder ?? 'Select…'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function TextArea({
  value, onChange, placeholder, maxLength,
}: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <div>
      <textarea
        className="input min-h-[80px] resize-y"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {maxLength && (
        <p className="text-xs text-neutral-400 mt-1 text-right">{value.length}/{maxLength}</p>
      )}
    </div>
  );
}

export function PasswordInput({
  value, onChange, placeholder, required,
}: { value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input pr-10"
        placeholder={placeholder ?? '••••••••'}
        required={required}
        minLength={8}
        autoComplete="new-password"
      />
      <button
        type="button" tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  );
}

/** Multi-tag input for research interests */
export function TagInput({
  tags, onChange, placeholder,
}: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={draft}
          placeholder={placeholder ?? 'Type and press Add'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="px-4 rounded-lg text-white text-sm font-semibold" style={{ background: GREEN }}>
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
