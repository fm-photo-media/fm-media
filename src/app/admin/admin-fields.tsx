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

export function FileInput({ name, label, required = false }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        required={required}
        className="rounded-md border border-line px-3 py-2 font-normal file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
      />
      <span className="text-xs font-normal text-ink/55">JPEG, PNG, WebP, or AVIF. Max 8 MB.</span>
    </label>
  );
}

export const adminErrors: Record<string, string> = {
  "confirm-delete": "Check the confirmation box before deleting.",
  "invalid-service": "Service details are incomplete or invalid.",
  "invalid-image": "Gallery image details are incomplete or use an unsupported image file.",
  "blob-missing": "Image uploads need Vercel Blob connected. Add BLOB_READ_WRITE_TOKEN in Vercel environment variables.",
  "upload-failed": "The image could not be uploaded. Check that Vercel Blob storage is connected."
};

export const adminSuccess: Record<string, string> = {
  "gallery-created": "Gallery image uploaded and added.",
  "gallery-updated": "Gallery image updated.",
  "gallery-deleted": "Gallery image deleted."
};

export function AdminNotice({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error ? (
        <p className="mt-4 rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-clay" role="alert">
          {adminErrors[error] ?? "Something needs attention before saving."}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-ink" role="status">
          {adminSuccess[success] ?? "Saved."}
        </p>
      ) : null}
    </>
  );
}
