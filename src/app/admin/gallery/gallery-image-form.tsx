/// <reference types="react-dom/canary" />
"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { discardUnsavedGalleryUpload } from "@/app/actions";
import { Checkbox, TextInput } from "@/app/admin/admin-fields";
import {
  ALLOWED_IMAGE_TYPES,
  CLIENT_UPLOAD_TIMEOUT_MS,
  MAX_GALLERY_UPLOAD_BYTES,
  UNSENT_AFTER_UPLOAD_MESSAGE,
  clientUploadErrorMessage,
  galleryUploadPathname,
  isAllowedImageType,
  shouldUploadFromBrowser
} from "@/lib/upload";

// Used to add an image and (QA-6) to replace one: files up to SERVER_UPLOAD_BYTES post
// with the form to the server action; bigger ones go browser -> Blob first, and the form
// then submits only the new URL. The server re-checks every file's real type (SEC-11).
//
// QA-24: after a browser upload the file input is emptied (so the big file isn't posted
// to the 1 MB action) and its `required` is lifted for that one submit, because the rule
// is "a file OR an uploaded blob URL". If the submit still doesn't start, the form says so
// (role="alert"), gives the file back, re-enables the button and discards the upload.

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

/** The submit button. It reads the form's pending state, so it is disabled while saving. */
function SubmitButton({
  label,
  isUploading,
  progress,
  onPendingChange
}: {
  label: string;
  isUploading: boolean;
  progress: number;
  onPendingChange: (pending: boolean) => void;
}) {
  const { pending } = useFormStatus();

  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);

  const text = isUploading ? (progress > 0 ? `Uploading ${progress}%` : "Preparing upload...") : pending ? "Saving..." : label;

  return (
    <button
      disabled={isUploading || pending}
      className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-ink/55"
    >
      {text}
    </button>
  );
}

export function GalleryImageForm({ action, defaults, fileLabel, submitLabel, requireFile = false }: GalleryImageFormProps) {
  const hintId = `${defaults?.id ?? "new"}-image-hint`;
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<HTMLInputElement>(null);
  // True for exactly one submit: the one sent after a browser upload.
  const allowSubmitRef = useRef(false);
  // Set when that submit actually starts (the submit event fired).
  const submitStartedRef = useRef(false);
  // True while the server action runs (from useFormStatus), so Enter can't send twice.
  const pendingRef = useRef(false);
  const uploadingRef = useRef(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState("");

  const handlePendingChange = useCallback((pending: boolean) => {
    pendingRef.current = pending;
    if (!pending) setStatus("");
  }, []);

  function finishUpload() {
    uploadingRef.current = false;
    setIsUploading(false);
    setProgress(0);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (allowSubmitRef.current) {
      // The submit after a browser upload: let it through to the action, once.
      allowSubmitRef.current = false;
      submitStartedRef.current = true;
      return;
    }

    if (pendingRef.current || uploadingRef.current) {
      // Already uploading or saving: a second Enter or click must not send it twice.
      event.preventDefault();
      return;
    }

    const file = fileRef.current?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    setError("");

    if (!isAllowedImageType(file.type)) {
      event.preventDefault();
      setError("Choose a JPEG, PNG, WebP, or AVIF image.");
      return;
    }

    if (file.size > MAX_GALLERY_UPLOAD_BYTES) {
      event.preventDefault();
      setError("Choose an image under 10 MB.");
      return;
    }

    if (!shouldUploadFromBrowser(file.size)) {
      return;
    }

    event.preventDefault();
    uploadingRef.current = true;
    setIsUploading(true);
    setProgress(0);
    setStatus("Preparing upload...");

    // QA-21: give up after CLIENT_UPLOAD_TIMEOUT_MS and say so, instead of spinning
    // while the Blob client retries. The abort stops its requests; the race makes sure
    // the form comes back even if a request ignores the abort.
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error("upload timed out"));
      }, CLIENT_UPLOAD_TIMEOUT_MS);
    });

    let blobUrl: string;
    try {
      // SEC-11: a generated name; the user's file name is never used.
      const uploading = upload(galleryUploadPathname(file.type), file, {
        access: "public",
        contentType: file.type,
        handleUploadUrl: "/api/gallery-upload",
        multipart: file.size > 4 * 1024 * 1024,
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => {
          setProgress(percentage);
          setStatus("Uploading image...");
        }
      });
      // A late rejection after the timeout won, so it isn't reported as unhandled.
      uploading.catch(() => undefined);
      blobUrl = (await Promise.race([uploading, timeout])).url;
      clearTimeout(timer);
    } catch (uploadError) {
      clearTimeout(timer);
      if (!timedOut) controller.abort();
      // The fields and the chosen file are left as they were, so the owner can retry.
      setError(clientUploadErrorMessage(uploadError, timedOut));
      setStatus("");
      finishUpload();
      return;
    }

    const form = formRef.current;
    const fileInput = fileRef.current;
    const imageUrlInput = imageUrlRef.current;
    const previousImageUrl = imageUrlInput?.value ?? "";

    if (imageUrlInput) imageUrlInput.value = blobUrl;
    if (fileInput) {
      // QA-24: the blob URL now satisfies "file OR uploaded URL", so the emptied file
      // input must not block this submit. `required` comes back right after.
      fileInput.required = false;
      fileInput.value = "";
    }

    // The upload is done, so the button can switch to "Saving..." (useFormStatus).
    finishUpload();
    setStatus("Saving image...");
    allowSubmitRef.current = true;
    submitStartedRef.current = false;
    try {
      form?.requestSubmit();
    } catch {
      // Handled below: the submit didn't start.
    }
    allowSubmitRef.current = false;
    if (fileInput) fileInput.required = requireFile;

    if (submitStartedRef.current) {
      // The action now runs; the server cleans up the blob on any error it reports.
      submitStartedRef.current = false;
      return;
    }

    // The form could not be sent (for example a field became invalid): give the file
    // back, say so, and remove the uploaded file so it isn't orphaned.
    if (imageUrlInput) imageUrlInput.value = previousImageUrl;
    if (fileInput) {
      try {
        const files = new DataTransfer();
        files.items.add(file);
        fileInput.files = files.files;
      } catch {
        // Older browsers: the owner picks the file again.
      }
    }
    setStatus("");
    setError(UNSENT_AFTER_UPLOAD_MESSAGE);
    form?.reportValidity();
    discardUnsavedGalleryUpload(blobUrl).catch((discardError) => {
      console.error("[gallery] could not discard an unsaved upload", discardError);
    });
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
          name="imageFile"
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          required={requireFile}
          aria-describedby={hintId}
          className="rounded-md border border-line px-3 py-2 font-normal file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />
        <span id={hintId} className="text-xs font-normal text-ink/55">
          JPEG, PNG, WebP, or AVIF. Max 10 MB.
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="width" label="Width" type="number" defaultValue={defaults?.width ?? 1600} />
        <TextInput name="height" label="Height" type="number" defaultValue={defaults?.height ?? 1100} />
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <Checkbox name="featured" label="Featured" defaultChecked={defaults?.featured} />
        <Checkbox name="published" label="Published" defaultChecked={defaults?.published ?? true} />
        <SubmitButton label={submitLabel} isUploading={isUploading} progress={progress} onPendingChange={handlePendingChange} />
      </div>
      <p className="text-sm font-medium text-ink/65" role="status">
        {status}
      </p>
      {error ? (
        <p className="rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-clay" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
