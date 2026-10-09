import type { ReactNode } from 'react';

export function Field({ label, htmlFor, required, optional, children, hint, error }: {
  label: string; htmlFor: string; required?: boolean; optional?: boolean;
  children: ReactNode; hint?: ReactNode; error?: string;
}) {
  return <div className="field">
    <label htmlFor={htmlFor}>{label}{required && <span className="required" aria-hidden="true"> *</span>}{optional && <span className="optional">Optional</span>}</label>
    {children}
    {hint && <div className="helper" id={`${htmlFor}-hint`}>{hint}</div>}
    {error && <p className="error" role="alert" id={`${htmlFor}-error`}>{error}</p>}
  </div>;
}
