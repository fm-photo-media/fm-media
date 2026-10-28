import { CAPTION_MESSAGES } from "@/lib/captions";

export function TextInput({
  name,
  label,
  defaultValue,
  type = "text",
  required = true,
  hint,
  maxLength,
  placeholder,
  idPrefix,
  pattern,
  patternMessage
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  hint?: string;
  maxLength?: number;
  placeholder?: string;
  idPrefix?: string;
  /** QA-27: checked by the browser before sending; `patternMessage` is shown when it fails. */
  pattern?: string;
  patternMessage?: string;
}) {
  const hintId = hint ? `${idPrefix ?? "f"}-${name}-hint` : undefined;
  return (
    <label className="grid gap-1 text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        pattern={pattern}
        title={pattern ? patternMessage : undefined}
        aria-describedby={hintId}
        className="min-h-[40px] rounded-md border border-[#6b7380] px-3 py-2 font-normal"
      />
      {hint ? (
        <span id={hintId} className="text-sm font-normal text-ink/75">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-ink">
      {/* QA-23: a 24px box inside a 44px row. */}
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-6 w-6 accent-[#044fb5]" />
      {label}
    </label>
  );
}

export const adminErrors: Record<string, string> = {
  "confirm-delete": "Check the confirmation box before deleting.",
  "invalid-service": "Service details are incomplete or invalid.",
  // QA-27 (round 1): the shoot and town rules, said plainly (captions.ts).
  "invalid-shoot": `Not saved: ${CAPTION_MESSAGES.shoot}`,
  "invalid-town": `Not saved: ${CAPTION_MESSAGES.town}`,
  "invalid-caption": `Not saved: ${CAPTION_MESSAGES.shoot} ${CAPTION_MESSAGES.town}`,
  "invalid-image":"Gallery image details are incomplete, the file isn't a JPEG, PNG, WebP or AVIF image, or the image is an outside link (such as a stock photo). Upload your own image file.",
  "blob-missing": "Image uploads need Vercel Blob connected. Add BLOB_READ_WRITE_TOKEN in Vercel environment variables.",
  "upload-failed": "The image could not be uploaded. Check that Vercel Blob storage is connected.",
  "not-found": "That gallery image no longer exists.",
  "invalid-months": "Enter a whole number of months from 1 to 120."
};

export const adminSuccess: Record<string, string> = {
  "gallery-created": "Gallery image uploaded and added.",
  "gallery-updated": "Gallery image updated.",
  "gallery-deleted": "Gallery image deleted.",
  "service-created": "Service added.",
  "service-updated": "Service updated.",
  "service-deleted": "Service deleted.",
  "inquiry-updated": "Inquiry updated.",
  "inquiry-deleted": "Inquiry deleted.",
  "inquiries-purged": "Old inquiries deleted."
};

/** QA-3: pages pass their awaited searchParams here. `count` adds a number to some notices. */
export function AdminNotice({ error, success, count }: { error?: string; success?: string; count?: string }) {
  const purged = success === "inquiries-purged" && count && /^[0-9]+$/.test(count) ? Number(count) : null;
  const successText =
    purged !== null ? `Deleted ${purged} old ${purged === 1 ? "inquiry" : "inquiries"}.` : success ? (adminSuccess[success] ?? "Saved.") : null;

  return (
    <>
      {error ? (
        <p className="mt-4 rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-clay" role="alert">
          {adminErrors[error] ?? "Something needs attention before saving."}
        </p>
      ) : null}
      {successText ? (
        <p className="mt-4 rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-ink" role="status">
          {successText}
        </p>
      ) : null}
    </>
  );
}
