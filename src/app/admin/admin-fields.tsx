import type { ReactNode } from "react";
import { ALT_TEXT_MESSAGE, CAPTION_MESSAGES } from "@/lib/captions";

// Batch 5b: the admin's form fields (design.md admin tokens: label above, 44px control, hint
// under it in 13px). Every field gets an id from its form's prefix, so labels and hints are
// tied to their own input even when a page holds more than one form (QA, 5a leftovers).

type FieldBase = {
  name: string;
  label: string;
  idPrefix: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
};

function ids(idPrefix: string, name: string, hint: unknown) {
  const id = `${idPrefix}-${name}`;
  return { id, hintId: hint ? `${id}-hint` : undefined };
}

function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return id ? (
    <small id={id} className="ad-hint">
      {children}
    </small>
  ) : null;
}

export function TextInput({
  name,
  label,
  idPrefix,
  hint,
  required = true,
  className,
  defaultValue,
  type = "text",
  maxLength,
  placeholder,
  inputMode,
  min,
  pattern,
  patternMessage
}: FieldBase & {
  defaultValue?: string | number;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  min?: number;
  /** QA-27: checked by the browser before sending; `patternMessage` is shown when it fails. */
  pattern?: string;
  patternMessage?: string;
}) {
  const { id, hintId } = ids(idPrefix, name, hint);
  return (
    <div className={`ad-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        min={min}
        pattern={pattern}
        title={pattern ? patternMessage : undefined}
        aria-describedby={hintId}
        className={`ad-input${type === "number" || inputMode === "numeric" ? " tnum" : ""}`}
      />
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}

export function TextArea({
  name,
  label,
  idPrefix,
  hint,
  required = true,
  className,
  defaultValue,
  rows = 3,
  maxLength
}: FieldBase & { defaultValue?: string; rows?: number; maxLength?: number }) {
  const { id, hintId } = ids(idPrefix, name, hint);
  return (
    <div className={`ad-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-describedby={hintId}
        className="ad-input"
      />
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}

export function SelectField({
  name,
  label,
  idPrefix,
  hint,
  className,
  defaultValue,
  options
}: FieldBase & { defaultValue?: string; options: { value: string; label: string }[] }) {
  const { id, hintId } = ids(idPrefix, name, hint);
  return (
    <div className={`ad-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={defaultValue} aria-describedby={hintId} className="ad-input">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
  idPrefix,
  disabled,
  describedBy
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  idPrefix: string;
  disabled?: boolean;
  describedBy?: string;
}) {
  const id = `${idPrefix}-${name}`;
  return (
    <label className="ad-check" htmlFor={id}>
      {/* QA-23: a 20px box inside a 44px row. */}
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} disabled={disabled} aria-describedby={describedBy} />
      <span>{label}</span>
    </label>
  );
}

/** A delete behind a disclosure that names what goes (works without script). */
export function ConfirmDelete({
  summary,
  summaryLabel,
  question,
  action,
  confirmLabel,
  confirmAriaLabel,
  children,
  className
}: {
  summary: string;
  summaryLabel?: string;
  question: string;
  action: (formData: FormData) => void | Promise<void>;
  confirmLabel: string;
  confirmAriaLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <details className={`ad-confirm${className ? ` ${className}` : ""}`}>
      <summary className="ad-btn ad-btn--text" aria-label={summaryLabel}>
        {summary}
      </summary>
      <form action={action} className="ad-confirm__box">
        {children}
        {/* The server still checks this (requireDeleteConfirmation). */}
        <input type="hidden" name="confirmDelete" value="on" />
        <p>{question}</p>
        <button className="ad-btn ad-btn--danger" aria-label={confirmAriaLabel}>
          {confirmLabel}
        </button>
      </form>
    </details>
  );
}

export const adminErrors: Record<string, string> = {
  "confirm-delete": "Nothing was deleted. Confirm the delete and try again.",
  "invalid-service": "Not saved: a required service detail is missing or too short. Check the name, web address, summary, description, what's included and turnaround.",
  // QA-27 (round 1): the shoot and town rules, said plainly (captions.ts).
  "invalid-shoot": `Not saved: ${CAPTION_MESSAGES.shoot}`,
  "invalid-town": `Not saved: ${CAPTION_MESSAGES.town}`,
  "invalid-caption": `Not saved: ${CAPTION_MESSAGES.shoot} ${CAPTION_MESSAGES.town}`,
  // DES-15 (batch 5b).
  "invalid-alt": `Not saved: ${ALT_TEXT_MESSAGE}`,
  "image-too-small": "Not saved: this photo is smaller than 320 × 240 pixels. Upload a larger file.",
  "invalid-image":
    "Not saved: the title is missing, the file isn't a JPEG, PNG, WebP or AVIF image, or the image is an outside link (such as a stock photo). Upload your own image file.",
  // Batch 5b note 6: no setting names in owner-facing copy.
  "blob-missing": "Photo uploads aren't connected to the site's file storage yet, so nothing was uploaded. Ask your web developer to connect it.",
  "upload-failed": "The photo could not be uploaded to the site's file storage. Try again in a few minutes.",
  "not-found": "That photo no longer exists.",
  "invalid-months": "Enter a whole number of months from 1 to 120."
};

export const adminSuccess: Record<string, string> = {
  "gallery-created": "Photo uploaded.",
  "gallery-updated": "Photo saved.",
  // QA-32: the file line only when an own-store file was actually deleted.
  "gallery-deleted": "Photo deleted.",
  "gallery-deleted-file": "Photo deleted, and its file removed from storage.",
  "service-created": "Service added.",
  "service-updated": "Service saved. The site, the price list and the booking form show it now.",
  "service-deleted": "Service deleted.",
  "inquiry-updated": "Request updated.",
  "inquiry-deleted": "Request deleted.",
  "inquiries-purged": "Old requests deleted."
};

/** QA-3: pages pass their awaited searchParams here. `count` adds a number to some notices. */
export function AdminNotice({ error, success, count }: { error?: string; success?: string; count?: string }) {
  const purged = success === "inquiries-purged" && count && /^[0-9]+$/.test(count) ? Number(count) : null;
  const successText =
    purged !== null ? `Deleted ${purged} old ${purged === 1 ? "request" : "requests"}.` : success ? (adminSuccess[success] ?? "Saved.") : null;

  return (
    <>
      {error ? (
        <p className="ad-notice ad-notice--error" role="alert">
          {adminErrors[error] ?? "Something needs attention before saving."}
        </p>
      ) : null}
      {successText ? (
        <p className="ad-notice" role="status">
          {successText}
        </p>
      ) : null}
    </>
  );
}
