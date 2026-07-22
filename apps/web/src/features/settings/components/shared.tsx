export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`settings-toggle ${checked ? "settings-toggle-on" : ""}`}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

export function SectionPanel({ title, description, accent, children }: {
  title: string;
  description?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-panel" style={{ "--panel-accent": accent ?? "#6366f1" } as React.CSSProperties}>
      <div className="settings-panel-accent-bar" />
      <div className="settings-panel-head">
        <div>
          <p className="settings-panel-title">{title}</p>
          {description && <p className="settings-panel-desc">{description}</p>}
        </div>
      </div>
      <div className="settings-panel-body">{children}</div>
    </div>
  );
}

export function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-field-row">
      <div className="settings-field-label-wrap">
        <label className="settings-field-label">{label}</label>
        {hint && <p className="settings-field-hint">{hint}</p>}
      </div>
      <div className="settings-field-control">{children}</div>
    </div>
  );
}
