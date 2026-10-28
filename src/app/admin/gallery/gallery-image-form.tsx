/// <reference types="react-dom/canary" />
"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { discardUnsavedGalleryUpload } from "@/app/actions";
import { TextInput } from "@/app/admin/admin-fields";
import { CAPTION_MESSAGES } from "@/lib/captions";
import {
  ALLOWED_IMAGE_TYPES,
  CLIENT_UPLOAD_TIMEOUT_MS,
  MAX_GALLERY_UPLOAD_BYTES,
  UNSENT_AFTER_UPLOAD_MESSAGE,
  clientUploadErrorMessage,
  galleryUploadPathname,
  imageDimensions,
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
  shoot?: string | null;
  town?: string | null;
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
  fileHint?: string;
  submitLabel: string;
  formLabel: string;
  categories: string[];
  requireFile?: boolean;
};

const DEFAULT_SIZE = { width: 1600, height: 1100 };

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
      className="ad-btn ad-btn--primary"
    >
      {text}
    </button>
  );
}

export function GalleryImageForm({
  action,
  defaults,
  fileLabel,
  fileHint = "",
  submitLabel,
  formLabel,
  categories,
  requireFile = false
}: GalleryImageFormProps) {
  const formId = defaults?.id ?? "new";
  const hintId = `${formId}-image-hint`;
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
  // DES-15 (batch 5b): Published can only be ticked once the photo has alt text.
  const [alt, setAlt] = useState(defaults?.alt ?? "");
  const [published, setPublished] = useState(Boolean(defaults?.published) && (defaults?.alt ?? "").trim().length >= 8);
  // Batch 5b note 7: the size is read from the chosen file, never typed in.
  const [size, setSize] = useState({ width: defaults?.width ?? DEFAULT_SIZE.width, height: defaults?.height ?? DEFAULT_SIZE.height });
  const [sizeNote, setSizeNote] = useState("");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSizeNote("");
    if (!file) {
      setSize({ width: defaults?.width ?? DEFAULT_SIZE.width, height: defaults?.height ?? DEFAULT_SIZE.height });
      return;
    }
    try {
      const read = imageDimensions(new Uint8Array(await file.arrayBuffer()));
      if (read) {
        setSize(read);
        setSizeNote(`This photo is ${read.width} × ${read.height} pixels.`);
      }
    } catch {
      // The server reads it again for files it receives; otherwise the old size stays.
    }
  }

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


  const altReady = alt.trim().length >= 8;
  const id = (name: string) => `${formId}-${name}`;
  const categoryOptions = Array.from(new Set([...(defaults?.category ? [defaults.category] : []), ...categories]));

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="ad-edit" aria-label={formLabel}>
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input ref={imageUrlRef} type="hidden" name="imageUrl" defaultValue={defaults?.imageUrl ?? ""} />
      {/* Batch 5b note 7: the pixel size is read from the file (here, and again on the server). */}
      <input type="hidden" name="width" value={size.width} />
      <input type="hidden" name="height" value={size.height} />

      <div className="ad-field ad-span-2">
        <label htmlFor={id("imageFile")}>{fileLabel}</label>
        <input
          id={id("imageFile")}
          ref={fileRef}
          name="imageFile"
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          required={requireFile}
          aria-describedby={hintId}
          onChange={handleFileChange}
          className="ad-input"
        />
        {/* QA-23: 13px+ at 7:1. */}
        <small id={hintId} className="ad-hint">
          {fileHint} JPEG, PNG, WebP or AVIF, up to 10 MB. Files over 900 KB upload straight to storage.
          {sizeNote ? (
            <>
              {" "}
              <span className="tnum">{sizeNote}</span>
            </>
          ) : null}
        </small>
      </div>

      {/* Legal R2 (round 1): titles, shoots, towns and alt text are public captions. */}
      <TextInput
        name="title"
        label="Title"
        defaultValue={defaults?.title}
        idPrefix={formId}
        placeholder="Front exterior"
        hint="No street names or house numbers."
        maxLength={160}
        className="ad-span-2"
      />
      <div className="ad-field ad-span-2">
        <label htmlFor={id("alt")}>Alt text</label>
        <textarea
          id={id("alt")}
          name="alt"
          rows={2}
          maxLength={400}
          value={alt}
          onChange={(event) => {
            setAlt(event.target.value);
            if (event.target.value.trim().length < 8) setPublished(false);
          }}
          aria-describedby={id("alt-hint")}
          className="ad-input"
        />
        <small id={id("alt-hint")} className="ad-hint">
          Say what the photo shows, for people who can&apos;t see it. Example: &ldquo;Living room with a sectional sofa and hardwood
          floor&rdquo;. No street names or house numbers. Needed before the photo can be published.
        </small>
      </div>
      {/* Batch 5: the portfolio groups photos by shoot and captions them by town. */}
      <TextInput
        name="shoot"
        label="Shoot (optional)"
        defaultValue={defaults?.shoot ?? ""}
        required={false}
        maxLength={80}
        idPrefix={formId}
        placeholder="Frame house"
        hint="Photos with the same shoot name show together on the portfolio. No street names or house numbers."
        // QA-27: checked before sending, so a refused value never loses the other edits.
        pattern="(?!#)[^\p{Nd}]*"
        patternMessage={CAPTION_MESSAGES.shoot}
      />
      <TextInput
        name="town"
        label="Town (optional)"
        defaultValue={defaults?.town ?? ""}
        required={false}
        maxLength={60}
        idPrefix={formId}
        placeholder="Oak Park"
        hint="The town only. Never the street address."
        pattern="[^\p{Nd}]*"
        patternMessage={CAPTION_MESSAGES.town}
      />
      <div className="ad-field">
        <label htmlFor={id("category")}>Category</label>
        <select id={id("category")} name="category" defaultValue={defaults?.category ?? categoryOptions[0]} className="ad-input">
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div className="ad-field">
        <span className="ad-field__label" id={id("visibility")}>
          On the site
        </span>
        <div role="group" aria-labelledby={id("visibility")}>
          <label className="ad-check" htmlFor={id("published")}>
            <input
              id={id("published")}
              name="published"
              type="checkbox"
              checked={published}
              disabled={!altReady}
              aria-describedby={altReady ? undefined : id("published-hint")}
              onChange={(event) => setPublished(event.target.checked)}
            />
            <span>Published</span>
          </label>
          <label className="ad-check" htmlFor={id("featured")}>
            <input id={id("featured")} name="featured" type="checkbox" defaultChecked={defaults?.featured} />
            <span>Featured on the home page</span>
          </label>
          {altReady ? null : (
            <small id={id("published-hint")} className="ad-hint">
              Add alt text to publish this photo.
            </small>
          )}
        </div>
      </div>

      {error ? (
        <p className="ad-alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="ad-edit__acts">
        <p className="ad-status" role="status">
          {status}
        </p>
        <SubmitButton label={submitLabel} isUploading={isUploading} progress={progress} onPendingChange={handlePendingChange} />
      </div>
    </form>
  );
}
