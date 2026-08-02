import React from 'react';
import { twMerge } from 'tailwind-merge';
import { useFieldContext } from './field';

/**
 * Shared control chrome. Uses border-strong because the old `border-border`
 * (#EBEAE8) failed contrast against the warm canvas, making inputs read as
 * flat text on some screens.
 */
export const controlBase =
  'flex w-full rounded-lg border border-border-strong bg-surface px-3 text-body-md text-text-primary ' +
  'shadow-sm transition-colors placeholder:text-text-muted ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-secondary';

const invalidStyles = 'border-danger-500 focus-visible:ring-danger-500/50 focus-visible:border-danger-500';

/** Pulls id / aria-describedby / aria-invalid from an enclosing <Field>. */
function useControlProps({ id, invalid, describedBy, required }) {
  const field = useFieldContext();
  return {
    controlId: id ?? field?.id,
    isRequired: required ?? field?.required,
    isInvalid: invalid ?? field?.invalid,
    describedByValue: describedBy ?? field?.describedBy,
  };
}

export const Input = React.forwardRef(({ className, type = 'text', invalid, ...props }, ref) => {
  const { controlId, isRequired, isInvalid, describedByValue } = useControlProps({
    id: props.id, invalid, required: props.required, describedBy: props['aria-describedby'],
  });
  return (
    <input
      type={type}
      ref={ref}
      {...props}
      id={controlId}
      required={isRequired}
      aria-invalid={isInvalid || undefined}
      aria-describedby={describedByValue}
      className={twMerge(controlBase, 'h-9 py-1.5', isInvalid && invalidStyles, className)}
    />
  );
});
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className, rows = 3, invalid, ...props }, ref) => {
  const { controlId, isRequired, isInvalid, describedByValue } = useControlProps({
    id: props.id, invalid, required: props.required, describedBy: props['aria-describedby'],
  });
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      id={controlId}
      required={isRequired}
      aria-invalid={isInvalid || undefined}
      aria-describedby={describedByValue}
      className={twMerge(controlBase, 'py-2 resize-y min-h-[4.5rem]', isInvalid && invalidStyles, className)}
    />
  );
});
Textarea.displayName = 'Textarea';

/**
 * Currency input. Money should always render with the tenant's symbol and
 * tabular figures so columns of amounts line up.
 */
export const CurrencyInput = React.forwardRef(({ className, symbol = '₹', invalid, ...props }, ref) => {
  const { controlId, isInvalid, describedByValue } = useControlProps({
    id: props.id, invalid, describedBy: props['aria-describedby'],
  });
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-md text-text-muted"
        aria-hidden="true"
      >
        {symbol}
      </span>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        {...props}
        id={controlId}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedByValue}
        className={twMerge(
          controlBase,
          'h-9 py-1.5 pl-8 text-right tabular-nums',
          isInvalid && invalidStyles,
          className
        )}
      />
    </div>
  );
});
CurrencyInput.displayName = 'CurrencyInput';

/** Checkbox with a real label association. */
export const Checkbox = React.forwardRef(({ className, label, description, id, ...props }, ref) => {
  const field = useFieldContext();
  const inputId = id ?? field?.id;
  return (
    <label
      htmlFor={inputId}
      className={twMerge('flex items-start gap-2.5 cursor-pointer py-1 select-none', className)}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-border-strong accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
        {...props}
      />
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-body-md text-text-primary">{label}</span>}
          {description && <span className="block text-body-sm text-text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
});
Checkbox.displayName = 'Checkbox';

export const Radio = React.forwardRef(({ className, label, description, id, ...props }, ref) => {
  const field = useFieldContext();
  const inputId = id ?? field?.id;
  return (
    <label
      htmlFor={inputId}
      className={twMerge('flex items-start gap-2.5 cursor-pointer py-1 select-none', className)}
    >
      <input
        ref={ref}
        id={inputId}
        type="radio"
        className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer border-border-strong accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
        {...props}
      />
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-body-md text-text-primary">{label}</span>}
          {description && <span className="block text-body-sm text-text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
});
Radio.displayName = 'Radio';

/** Switch — for immediate-effect settings, as opposed to form submission. */
export const Switch = React.forwardRef(({ className, checked, onCheckedChange, label, disabled, id, ...props }, ref) => {
  const field = useFieldContext();
  const inputId = id ?? field?.id;
  return (
    <span className={twMerge('flex items-center gap-3 select-none', className)}>
      <button
        ref={ref}
        id={inputId}
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={typeof label === 'string' ? label : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={twMerge(
          'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          checked ? 'bg-primary' : 'bg-border-strong'
        )}
        {...props}
      >
        <span
          className={twMerge(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-1'
          )}
        />
      </button>
      {label && (
        <label htmlFor={inputId} className="text-body-md text-text-primary cursor-pointer">
          {label}
        </label>
      )}
    </span>
  );
});
Switch.displayName = 'Switch';
