"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState, type FormEvent } from "react";
import { Checkbox, TextInput } from "@/app/admin/admin-fields";

const MAX_GALLERY_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 2.5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2200;
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

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function jpegName(name: string) {
  return safeUploadName(name).replace(/\.[a-z0-9]+$/i, "") + ".jpg";
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Image optimization failed."));
        }
      },
      "image/jpeg",
      quality
    );
  });
}

async function optimizeImage(file: File) {
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    image.close();
    throw new Error("Image optimization is not supported in this browser.");
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  image.close();

  let quality = 0.78;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > TARGET_IMAGE_BYTES && quality > 0.56) {
    quality -= 0.06;
    blob = await canvasToBlob(canvas, quality);
  }

  return {
    file: new File([blob], jpegName(file.name), { type: "image/jpeg" }),
    width,
    height
  };
}

export function GalleryImageForm({ action, defaults, fileLabel, submitLabel, requireFile = false }: GalleryImageFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<HTMLInputElement>(null);
  const allowSubmitRef = useRef(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState("");

  function updateDimensionInput(name: "width" | "height", value: number) {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLInputElement) {
      field.value = String(value);
    }
  }

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

    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setError("Choose an original image under 20 MB.");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setStatus("Optimizing image...");

    try {
      const optimized = await optimizeImage(file);

      if (optimized.file.size > MAX_GALLERY_UPLOAD_BYTES) {
        throw new Error("Optimized image is still too large.");
      }

      updateDimensionInput("width", optimized.width);
      updateDimensionInput("height", optimized.height);
      setStatus(`Optimized ${formatFileSize(file.size)} to ${formatFileSize(optimized.file.size)}. Uploading...`);

      const pathname = `gallery/${Date.now()}-${optimized.file.name}`;
      const blob = await upload(pathname, optimized.file, {
        access: "public",
        contentType: optimized.file.type,
        handleUploadUrl: "/api/gallery-upload",
        multipart: optimized.file.size > 4 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(percentage)
      });

      if (imageUrlRef.current) {
        imageUrlRef.current.value = blob.url;
      }

      allowSubmitRef.current = true;
      formRef.current?.requestSubmit();
    } catch {
      setError("The image could not be optimized or uploaded. Try a smaller image or export it as a JPEG.");
      setStatus("");
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
        <span className="text-xs font-normal text-ink/55">JPEG, PNG, WebP, or AVIF. Original files up to 20 MB are optimized before upload.</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="width" label="Width" type="number" defaultValue={defaults?.width ?? 1600} />
        <TextInput name="height" label="Height" type="number" defaultValue={defaults?.height ?? 1100} />
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <Checkbox name="featured" label="Featured" defaultChecked={defaults?.featured} />
        <Checkbox name="published" label="Published" defaultChecked={defaults?.published ?? true} />
        <button disabled={isUploading} className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-ink/55">
          {isUploading ? (progress > 0 ? `Uploading ${progress}%` : "Optimizing...") : submitLabel}
        </button>
      </div>
      {status ? <p className="text-sm font-medium text-ink/65">{status}</p> : null}
      {error ? (
        <p className="rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-clay" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
