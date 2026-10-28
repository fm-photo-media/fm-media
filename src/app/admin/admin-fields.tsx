export function TextInput({
  name,
  label,
  defaultValue,
  type = "text",
  required = true
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="rounded-md border border-line px-3 py-2 font-normal"
      />
    </label>
  );
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-ink">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-clay" />
      {label}
    </label>
  );
}

export const adminErrors: Record<string, string> = {
  "confirm-delete": "Check the confirmation box before deleting.",
  "invalid-service": "Service details are incomplete or invalid.",
  "invalid-image": "Gallery image details are incomplete, or the file isn't a JPEG, PNG, WebP or AVIF image.",
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
