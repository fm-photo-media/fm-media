"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState, type FormEvent } from "react";
import { Checkbox, TextInput } from "@/app/admin/admin-fields";

const MAX_GALLERY_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

type GalleryImageFormValues = {
  id?: string;
  title?: string;
  alt?: string;
  category?: string;
  imageUrl?: string;
  width?: number;
  height?: number;
  featured?: boolean;
  published?: boolean;
};

type GalleryImageFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: GalleryImageFormValues;
  fileLabel: string;
  submitLabel: string;
  requireFile?: boolean;
};

function safeUploadName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function GalleryImageForm({ action, defaults, fileLabel, submitLabel, requireFile = false }: GalleryImageFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<HTMLInputElement>(null);
  const allowSubmitRef = useRef(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (allowSubmitRef.current) {
      return;
    }

    const file = fileRef.current?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    event.preventDefault();
    setError("");

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Choose a JPEG, PNG, WebP, or AVIF image.");
      return;
    }

    if (file.size > MAX_GALLERY_UPLOAD_BYTES) {
      setError("Choose an image under 10 MB.");
      return;
    }

    setIsUploading(true);

    try {
      const pathname = `gallery/${Date.now()}-${safeUploadName(file.name)}`;
      const blob = await upload(pathname, file, {
        access: "public",
        contentType: file.type,
        handleUploadUrl: "/api/gallery-upload",
        multipart: file.size > 4 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(percentage)
      });

      if (imageUrlRef.current) {
        imageUrlRef.current.value = blob.url;
      }

      allowSubmitRef.current = true;
      formRef.current?.requestSubmit();
    } catch {
      setError("The image could not be uploaded. Check Vercel Blob settings and try again.");
      setIsUploading(false);
    }
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="mt-5 grid gap-4">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input ref={imageUrlRef} type="hidden" name="imageUrl" defaultValue={defaults?.imageUrl ?? ""} />
      <TextInput name="title" label="Title" defaultValue={defaults?.title} />
      <TextInput name="alt" label="Alt Text" defaultValue={defaults?.alt} />
      <TextInput name="category" label="Category" defaultValue={defaults?.category} />
      <label className="grid gap-1 text-sm font-medium text-ink">
        {fileLabel}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required={requireFile}
          className="rounded-md border border-line px-3 py-2 font-normal file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />
        <span className="text-xs font-normal text-ink/55">JPEG, PNG, WebP, or AVIF. Max 10 MB.</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="width" label="Width" type="number" defaultValue={defaults?.width ?? 1600} />
        <TextInput name="height" label="Height" type="number" defaultValue={defaults?.height ?? 1100} />
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <Checkbox name="featured" label="Featured" defaultChecked={defaults?.featured} />
        <Checkbox name="published" label="Published" defaultChecked={defaults?.published ?? true} />
        <button disabled={isUploading} className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-ink/55">
          {isUploading ? `Uploading ${progress}%` : submitLabel}
        </button>
      </div>
      {error ? (
        <p className="rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-clay" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
