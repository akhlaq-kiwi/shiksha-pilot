import React, { createContext, useContext, useId } from 'react';
import { twMerge } from 'tailwind-merge';
import { AlertCircle } from 'lucide-react';

/**
 * Field — the labelled form-control wrapper.
 *
 * The app had 203 <Input> usages and 7 `htmlFor` labels, because the input
 * primitive owned no label/error/description slots and every call site invented
 * its own. Field owns them once:
 *
 *   - <label htmlFor="student_name"> wired to the control via a generated id
 *   - required indicator
 *   - description text, linked with aria-describedby
 *   - error message, linked with aria-describedby + aria-invalid
 *
 * Usage:
 *   <Field label="Student name" required error={errors.student_name}>
 *     <Input id="student_name" name="student_name" value={...} onChange={...} />
 *   </Field>
 *
 * Children that are Input/Select/Textarea pick up the id and ARIA wiring
 * automatically via context — no prop threading needed.
 */

const FieldContext = createContext(null);

export const useFieldContext = () => useContext(FieldContext);

export const Field = ({
  label,
  htmlFor,
  required = false,
  optional = false,
  description,
  error,
  hint,
  className,
  labelClassName,
  children,
  ...props
}) => {
  const generatedId = useId();
  const id = htmlFor || generatedId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error, required }}>
      <div className={twMerge('flex flex-col gap-1.5', className)} {...props}>
        {label && (
          <label
            htmlFor={id}
            className={twMerge('flex items-center gap-1 text-label text-text-secondary', labelClassName)}
          >
            {label}
            {required && (
              <span className="text-danger-600" aria-hidden="true">*</span>
            )}
            {required && <span className="sr-only">(required)</span>}
            {optional && !required && (
              <span className="font-normal text-text-muted">(optional)</span>
            )}
          </label>
        )}

        {description && (
          <p id={descriptionId} className="text-body-sm text-text-muted">
            {description}
          </p>
        )}

        {children}

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-1.5 text-body-sm font-medium text-danger-700"
          >
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </p>
        ) : hint ? (
          <p className="text-body-sm text-text-muted">{hint}</p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
};

/**
 * Top-of-form error summary with jump links.
 * Long forms (the 1,468-line enrolment form especially) need this: a
 * field-level message 800px below the fold is invisible.
 */
export const FormErrorSummary = ({ errors, title = 'Please fix the following', className }) => {
  const rawEntries = Object.entries(errors || {}).filter(([, v]) => !!v);
  if (rawEntries.length === 0) return null;

  // Deduplicate entries by unique error message text
  const uniqueMap = new Map();
  rawEntries.forEach(([key, msg]) => {
    if (!uniqueMap.has(msg)) {
      uniqueMap.set(msg, key);
    }
  });
  const entries = Array.from(uniqueMap.entries()).map(([msg, key]) => [key, msg]);

  return (
    <div
      role="alert"
      tabIndex={-1}
      className={twMerge(
        'rounded-xl border border-danger-200 bg-danger-50 p-4',
        className
      )}
    >
      <p className="flex items-center gap-2 text-body-md font-semibold text-danger-700">
        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {title} ({entries.length})
      </p>
      <ul className="mt-2 space-y-1 pl-6">
        {entries.map(([key, message]) => (
          <li key={key} className="text-body-sm text-danger-700">
            <button
              type="button"
              className="text-left underline underline-offset-2 hover:no-underline"
              onClick={() => {
                const el =
                  document.querySelector(`[name="${key}"]`) || document.getElementById(key);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.focus?.();
                }
              }}
            >
              {message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Field;
