"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { adminPath, withParams } from "@/lib/admin-path";
import { runAutoPurge } from "@/lib/auto-purge-db";
import { getBookingOptions } from "@/lib/booking-options";
import { sendBookingNotification } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkAdminLoginLimit, checkRateLimit, formatWait } from "@/lib/rate-limit";
import { monthsBefore, parseMonths } from "@/lib/retention";
import {
  MAX_GALLERY_UPLOAD_BYTES,
  canonicalBlobUrl,
  checkUploadedBlob,
  detectImageType,
  galleryUploadPathname,
  imageDimensions,
  isAllowedImageType,
  isOwnBlobUrl,
  type ImageSize
} from "@/lib/upload";
import { galleryImageSchema, makeInquirySchema, serviceSchema } from "@/lib/validation";

export type FormState = {
  // "saved-email-failed": the inquiry is in the DB but the owner wasn't notified (QA-4).
  status: "idle" | "sent" | "saved-email-failed" | "error";
  ok: boolean;
  message: string;
  fields?: Record<string, string>;
};

const CALL_OR_TEXT = "(312) 375-5209";

const BOOKING_MESSAGES = {
  sent: "Thanks. Your shoot request is in, and we will follow up shortly.",
  emailFailed: `We got your request, but our notification failed. Please also call or text ${CALL_OR_TEXT}.`,
  emailCapped: `We got your request. Our notifications are paused for today, so please also call or text ${CALL_OR_TEXT}.`,
  invalid: "Check the highlighted fields and try again.",
  // QA-18: the real wait, from the limiter.
  rateLimited: (wait: string) =>
    `Too many requests from this connection. Please try again in ${wait}, or call or text ${CALL_OR_TEXT}.`,
  saveFailed: `Your request could not be saved. Please try again, or call or text ${CALL_OR_TEXT}.`
};

const SUBMISSION_KEY = /^[A-Za-z0-9-]{8,64}$/;
// SEC-19: the booking form's honeypot. Neutral name, no instructions, no autofill hint.
const HONEYPOT_FIELD = "ref_note";

function formString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function bookingResult(emailStatus: string): FormState {
  if (emailStatus === "FAILED") return { status: "saved-email-failed", ok: true, message: BOOKING_MESSAGES.emailFailed };
  if (emailStatus === "SKIPPED_CAP") return { status: "saved-email-failed", ok: true, message: BOOKING_MESSAGES.emailCapped };
  return { status: "sent", ok: true, message: BOOKING_MESSAGES.sent };
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

// SEC-27: a raw Prisma error can echo the customer's details, so booking logs keep only its name and code.
function errorSummary(error: unknown) {
  if (typeof error !== "object" || error === null) return "unknown error";
  const name = error instanceof Error ? error.name : "Error";
  const code = "code" in error && typeof error.code === "string" ? ` ${error.code}` : "";
  return `${name}${code}`;
}

async function existingSubmission(submissionKey: string | null) {
  if (!submissionKey) return null;
  return prisma.inquiry.findUnique({ where: { submissionKey }, select: { emailStatus: true } }).catch(() => null);
}

function checkboxValue(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// QA-15: every admin form posts a `returnTo` (validated by adminPath), so errors and
// notices land on the page the owner was on.
function returnPath(formData: FormData, fallback: string) {
  return adminPath(formString(formData, "returnTo"), fallback);
}

function requireDeleteConfirmation(formData: FormData, returnTo: string) {
  if (!checkboxValue(formData, "confirmDelete")) {
    redirect(withParams(returnTo, { error: "confirm-delete" }));
  }
}

// ---------------------------------------------------------------------------
// Gallery uploads and Blob cleanup
// ---------------------------------------------------------------------------

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * SEC-8 / SEC-24: delete a blob only if it is this project's own gallery file, by its
 * canonical URL (canonicalBlobUrl refuses any variant spelling). Never throws.
 * Returns true only when the file was actually deleted (QA-32).
 */
async function deleteBlobQuietly(url: string | null | undefined) {
  const canonical = url ? canonicalBlobUrl(url, blobToken()) : null;
  if (!canonical) return false;
  try {
    await del(canonical);
    return true;
  } catch (error) {
    console.error(`[gallery] could not delete blob ${canonical}`, error);
    return false;
  }
}

/**
 * SEC-8 / SEC-21 / SEC-24: only when no gallery row points at the same file, so a file
 * another row still shows is never deleted. The row count and del() both use the
 * canonical URL; anything that doesn't round-trip to it is refused. If the count fails,
 * nothing is deleted.
 */
async function deleteBlobIfUnused(url: string | null | undefined) {
  const canonical = url ? canonicalBlobUrl(url, blobToken()) : null;
  if (!canonical) return false;
  let stillUsed: number;
  try {
    stillUsed = await prisma.galleryImage.count({ where: { imageUrl: canonical } });
  } catch (error) {
    console.error(`[gallery] could not check whether blob ${canonical} is in use; keeping it`, error);
    return false;
  }
  return stillUsed === 0 ? deleteBlobQuietly(canonical) : false;
}

/**
 * SEC-11: a file uploaded straight from the browser (QA-6 path) is checked by its real
 * bytes too (checkUploadedBlob). Not an image, or a definite 4xx such as 404 or 403:
 * rejected (fails CLOSED). Only a genuine transient failure (network, timeout, 5xx) is
 * accepted, because the upload token's content-type allow-list still applies.
 */
async function verifyBrowserUpload(url: string) {
  const result = await checkUploadedBlob(url);
  if (result === "unverified") {
    console.warn(`[gallery] could not re-check uploaded blob ${url} (transient); relying on the upload token's type check`);
  } else if (result === "invalid") {
    console.warn(`[gallery] rejected browser upload ${url}: not an allowed image, or the store refused it`);
  }
  return result !== "invalid";
}

/**
 * Returns the image URL to save and, if this request created a new blob, its URL (so it
 * can be removed again if the rest of the form fails).
 */
async function galleryImageUrlFromForm(formData: FormData, existingUrl: string | null, returnTo: string) {
  const value = formData.get("imageFile");
  const file = value instanceof File && value.size > 0 ? value : null;

  if (!file) {
    const imageUrl = formString(formData, "imageUrl").trim() || existingUrl || "";
    const isNewBlob = imageUrl !== existingUrl && isOwnBlobUrl(imageUrl, blobToken());

    if (isNewBlob && !(await verifyBrowserUpload(imageUrl))) {
      // SEC-21: never delete a file another gallery row still uses.
      await deleteBlobIfUnused(imageUrl);
      redirect(withParams(returnTo, { error: "invalid-image" }));
    }

    // A browser upload's size was read from the file by the admin form (width/height fields).
    return { imageUrl, newBlobUrl: isNewBlob ? imageUrl : null, size: null };
  }

  if (file.size > MAX_GALLERY_UPLOAD_BYTES) {
    redirect(withParams(returnTo, { error: "invalid-image" }));
  }

  // SEC-11: trust the bytes, not the browser's MIME type or the file name.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);

  if (!type || !isAllowedImageType(type)) {
    redirect(withParams(returnTo, { error: "invalid-image" }));
  }

  if (!blobToken()) {
    redirect(withParams(returnTo, { error: "blob-missing" }));
  }

  let url: string;
  try {
    const blob = await put(galleryUploadPathname(type), Buffer.from(bytes), {
      access: "public",
      contentType: type,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365
    });
    url = blob.url;
  } catch (error) {
    console.error("[gallery] server upload failed", error);
    redirect(withParams(returnTo, { error: "upload-failed" }));
  }

  // Batch 5b: the size comes from the file's own header, not from a typed field.
  return { imageUrl: url, newBlobUrl: url, size: imageDimensions(bytes) };
}

// ---------------------------------------------------------------------------
// Admin sign-in (SEC-2, SEC-3, SEC-6, SEC-12, SEC-16)
// ---------------------------------------------------------------------------

// The login page shows waits of 1 to 1440 minutes (the 20-a-day window).
function waitMinutes(ms: number) {
  return String(Math.min(24 * 60, Math.max(1, Math.ceil(ms / 60000))));
}

export async function loginAdmin(formData: FormData) {
  const requestHeaders = await headers();

  // SEC-3 / SEC-16: 5 per 15 min and 20 a day per connection. Fails CLOSED. Only an
  // allowed attempt then feeds the log-only volume alarm (SEC-23: blocked ones write nothing).
  const limit = await checkAdminLoginLimit(prisma, requestHeaders);

  if (!limit.allowed) {
    redirect(
      limit.failed
        ? "/admin/login?error=unavailable"
        : withParams("/admin/login", { error: "rate-limited", wait: waitMinutes(limit.retryAfterMs) })
    );
  }

  let passwordOk = false;
  try {
    passwordOk = verifyAdminPassword(String(formData.get("password") ?? ""));
  } catch (error) {
    // SEC-6: weak or placeholder secrets in production. Refuse every sign-in.
    console.error("[admin-auth] admin secrets are not configured safely", error);
    redirect("/admin/login?error=unavailable");
  }

  if (!passwordOk) {
    console.warn("[admin-auth] failed sign-in attempt");
    await sleep(400 + Math.floor(Math.random() * 300));
    redirect("/admin/login?error=wrong-password");
  }

  try {
    await setAdminSession();
  } catch (error) {
    console.error("[admin-auth] could not create a session", error);
    redirect("/admin/login?error=unavailable");
  }

  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession().catch((error) => console.error("[admin-auth] logout could not revoke the session", error));
  redirect("/admin/login?success=signed-out");
}

/** Signs out every device (for a lost phone or a shared computer). */
export async function logoutAllAdminSessions() {
  await requireAdmin();
  await clearAdminSession({ everywhere: true });
  redirect("/admin/login?success=signed-out-everywhere");
}

// ---------------------------------------------------------------------------
// Public booking form
// ---------------------------------------------------------------------------

async function countHoneypotHit() {
  await prisma.siteCounter
    .upsert({ where: { key: "honeypot" }, create: { key: "honeypot", count: 1 }, update: { count: { increment: 1 } } })
    .catch((error) => console.error("[booking] could not count a honeypot hit", error));
}

export async function createInquiry(_: FormState, formData: FormData): Promise<FormState> {
  const requestHeaders = await headers();

  // SEC-4 / SEC-17: per-connection limits first (10 an hour, 20 a day), so spam and
  // invalid floods count too. Blocked attempts aren't recorded (QA-18).
  const limit = await checkRateLimit(prisma, "booking", requestHeaders);

  if (!limit.allowed) {
    return { status: "error", ok: false, message: BOOKING_MESSAGES.rateLimited(formatWait(limit.retryAfterMs)) };
  }

  // SEC-19 honeypot: people never see or fill it; bots do. Count it, pretend it worked,
  // and take about as long as a real submission so the timing doesn't give it away.
  if (formString(formData, HONEYPOT_FIELD)) {
    console.warn("[booking] honeypot field filled; request dropped");
    await countHoneypotHit();
    await sleep(600 + Math.floor(Math.random() * 900));
    return bookingResult("SENT");
  }

  // SEC-4 / QA-10: one inquiry per form submission, even if it arrives twice.
  const rawKey = formString(formData, "submissionKey");
  const submissionKey = SUBMISSION_KEY.test(rawKey) ? rawKey : null;
  const duplicate = await existingSubmission(submissionKey);

  if (duplicate) {
    return bookingResult(duplicate.emailStatus);
  }

  let options;

  try {
    options = await getBookingOptions();
  } catch (error) {
    console.error("[booking] could not load booking options", error);
    return { status: "error", ok: false, message: BOOKING_MESSAGES.saveFailed };
  }

  const parsed = makeInquirySchema({ options }).safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone"),
    agencyName: formString(formData, "agencyName"),
    propertyAddress: formString(formData, "propertyAddress"),
    squareFeet: formString(formData, "squareFeet"),
    photoPackage: formString(formData, "photoPackage"),
    addOns: formData.getAll("addOns").slice(0, 20).map(String).join(","),
    videoService: formData.getAll("videoService").slice(0, 20).map(String).join(","),
    firstShootOffer: formData.get("firstShootOffer"),
    preferredDate: formString(formData, "preferredDate"),
    preferredTime: formString(formData, "preferredTime"),
    preferredWindow: formString(formData, "preferredWindow") || undefined,
    message: formString(formData, "message")
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string>>((errors, issue) => {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??= issue.message;
      return errors;
    }, {});

    return { status: "error", ok: false, message: BOOKING_MESSAGES.invalid, fields };
  }

  let inquiry;

  try {
    inquiry = await prisma.inquiry.create({ data: { ...parsed.data, submissionKey } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // The same submission raced in twice; the first one owns the row.
      return bookingResult((await existingSubmission(submissionKey))?.emailStatus ?? "PENDING");
    }

    console.error(`[booking] could not save inquiry: ${errorSummary(error)}`);
    return { status: "error", ok: false, message: BOOKING_MESSAGES.saveFailed };
  }

  // QA-4: never hide a failed notification. Flag the row for /admin and log it.
  // SEC-17: over the site-wide daily email cap, the row is saved but no email is sent.
  let emailStatus = "SENT";
  let emailError: string | null = null;

  const emailCap = await checkRateLimit(prisma, "notificationEmail", requestHeaders);

  if (!emailCap.allowed) {
    emailStatus = "SKIPPED_CAP";
    console.warn(`[booking] daily notification email cap reached; inquiry ${inquiry.id} saved without an email`);
  } else {
    try {
      const result = await sendBookingNotification(inquiry);
      if (result.skipped) emailStatus = "SKIPPED";
    } catch (error) {
      emailStatus = "FAILED";
      emailError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      console.error(`[booking] notification email FAILED for inquiry ${inquiry.id}: ${emailError}`);
    }
  }

  await prisma.inquiry
    .update({ where: { id: inquiry.id }, data: { emailStatus, emailError } })
    .catch((error) =>
      console.error(`[booking] could not record email status for inquiry ${inquiry.id}: ${errorSummary(error)}`)
    );

  // LEG-1 / Ship condition A1: delete inquiries past the retention period. Throttled to
  // about once an hour, best effort, never throws (auto-purge.ts). It only ever deletes
  // rows older than the retention period, so it can't touch the booking just saved.
  await runAutoPurge();

  return bookingResult(emailStatus);
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

function revalidateServicePages() {
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/contact");
  revalidatePath("/admin");
  revalidatePath("/admin/services");
}

function parseService(formData: FormData) {
  return serviceSchema.safeParse({
    ...Object.fromEntries(formData),
    featured: checkboxValue(formData, "featured"),
    published: checkboxValue(formData, "published")
  });
}

export async function createService(formData: FormData) {
  await requireAdmin();
  const parsed = parseService(formData);

  if (!parsed.success) {
    redirect("/admin/services?error=invalid-service");
  }

  await prisma.service.create({ data: parsed.data });
  revalidateServicePages();
  redirect("/admin/services?success=service-created");
}

export async function updateService(formData: FormData) {
  await requireAdmin();
  const id = formString(formData, "id");
  const parsed = parseService(formData);

  if (!parsed.success) {
    // Batch 5b: back to the same row's editor, so the owner sees which service failed.
    redirect(withParams(`/admin/services?edit=${encodeURIComponent(id)}`, { error: "invalid-service" }));
  }

  await prisma.service.update({ where: { id }, data: parsed.data });
  revalidateServicePages();
  redirect("/admin/services?success=service-updated");
}

export async function deleteService(formData: FormData) {
  await requireAdmin();
  requireDeleteConfirmation(formData, "/admin/services");
  await prisma.service.delete({ where: { id: formString(formData, "id") } });
  revalidateServicePages();
  redirect("/admin/services?success=service-deleted");
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

function revalidateGalleryPages() {
  revalidatePath("/");
  revalidatePath("/portfolio");
  // Batch 5: the services side photo and About use the featured uploads too.
  revalidatePath("/services");
  revalidatePath("/about");
  revalidatePath("/admin");
  revalidatePath("/admin/gallery");
}

function parseGalleryImage(formData: FormData, imageUrl: string, size: ImageSize | null) {
  return galleryImageSchema.safeParse({
    ...Object.fromEntries(formData),
    ...(size ?? {}),
    imageUrl,
    featured: checkboxValue(formData, "featured"),
    published: checkboxValue(formData, "published")
  });
}

/** QA-27: a refused shoot or town gets its own notice instead of the generic image error. */
function galleryErrorCode(issues: readonly { path: readonly PropertyKey[] }[]) {
  const fields = new Set(issues.map((issue) => String(issue.path[0])));
  if (fields.size === 1 && fields.has("shoot")) return "invalid-shoot";
  if (fields.size === 1 && fields.has("town")) return "invalid-town";
  if (fields.size === 2 && fields.has("shoot") && fields.has("town")) return "invalid-caption";
  // Batch 5b / DES-15: alt text is needed to publish; a photo under 320 x 240 is refused.
  if (fields.size === 1 && fields.has("alt")) return "invalid-alt";
  if (fields.size > 0 && Array.from(fields).every((field) => field === "width" || field === "height")) return "image-too-small";
  return "invalid-image";
}

export async function createGalleryImage(formData: FormData) {
  await requireAdmin();
  const returnTo = "/admin/gallery";
  const { imageUrl, newBlobUrl, size } = await galleryImageUrlFromForm(formData, null, returnTo);
  const parsed = parseGalleryImage(formData, imageUrl, size);

  if (!parsed.success) {
    // SEC-21: the URL may be another row's file (a stale or crafted hidden field).
    await deleteBlobIfUnused(newBlobUrl);
    redirect(withParams(returnTo, { error: galleryErrorCode(parsed.error.issues) }));
  }

  await prisma.galleryImage.create({ data: parsed.data });
  revalidateGalleryPages();
  redirect("/admin/gallery?success=gallery-created");
}

export async function updateGalleryImage(formData: FormData) {
  await requireAdmin();
  const id = formString(formData, "id");
  const returnTo = `/admin/gallery/${encodeURIComponent(id)}`;
  const existing = await prisma.galleryImage.findUnique({ where: { id }, select: { imageUrl: true } });

  if (!existing) {
    redirect("/admin/gallery?error=not-found");
  }

  const { imageUrl, newBlobUrl, size } = await galleryImageUrlFromForm(formData, existing.imageUrl, returnTo);
  const parsed = parseGalleryImage(formData, imageUrl, size);

  if (!parsed.success) {
    // SEC-21: the URL may be another row's file (a stale or crafted hidden field).
    await deleteBlobIfUnused(newBlobUrl);
    redirect(withParams(returnTo, { error: galleryErrorCode(parsed.error.issues) }));
  }

  await prisma.galleryImage.update({ where: { id }, data: parsed.data });

  // SEC-8: the replaced file is removed from Blob, so it stops being public.
  if (existing.imageUrl !== parsed.data.imageUrl) {
    await deleteBlobIfUnused(existing.imageUrl);
  }

  revalidateGalleryPages();
  redirect(withParams(returnTo, { success: "gallery-updated" }));
}

/**
 * QA-24: the admin form calls this when a browser upload finished but the form could not
 * be sent, so the file isn't left orphaned. Admin only; deletes only this project's own
 * gallery file, and only if no row uses it (deleteBlobIfUnused). Never throws.
 */
export async function discardUnsavedGalleryUpload(url: string) {
  await requireAdmin();
  if (typeof url !== "string" || url.length > 500) return;
  await deleteBlobIfUnused(url);
}

export async function deleteGalleryImage(formData: FormData) {
  await requireAdmin();
  const returnTo = returnPath(formData, "/admin/gallery");
  requireDeleteConfirmation(formData, returnTo);

  const id = formString(formData, "id");
  const image = await prisma.galleryImage.findUnique({ where: { id }, select: { imageUrl: true } });

  let fileDeleted = false;
  if (image) {
    await prisma.galleryImage.delete({ where: { id } });
    // SEC-8: the file goes too (homeowners may ask for a photo to come down).
    fileDeleted = await deleteBlobIfUnused(image.imageUrl);
  }

  revalidateGalleryPages();
  // QA-32: the notice says the file was removed only when it really was.
  redirect(`/admin/gallery?success=${fileDeleted ? "gallery-deleted-file" : "gallery-deleted"}`);
}

// ---------------------------------------------------------------------------
// Inquiries (SEC-13 / LEG-1)
// ---------------------------------------------------------------------------

export async function updateInquiryContacted(formData: FormData) {
  await requireAdmin();
  const returnTo = returnPath(formData, "/admin");

  await prisma.inquiry.updateMany({
    where: { id: formString(formData, "id") },
    data: { status: checkboxValue(formData, "contacted") ? "CONTACTED" : "NEW" }
  });

  revalidatePath("/admin");
  redirect(withParams(returnTo, { success: "inquiry-updated" }));
}

export async function deleteInquiry(formData: FormData) {
  await requireAdmin();
  const returnTo = returnPath(formData, "/admin");
  requireDeleteConfirmation(formData, returnTo);
  await prisma.inquiry.deleteMany({ where: { id: formString(formData, "id") } });
  revalidatePath("/admin");
  redirect(withParams(returnTo, { success: "inquiry-deleted" }));
}

/** LEG-1 retention: a manual purge of inquiries received more than N months ago. */
export async function purgeOldInquiries(formData: FormData) {
  await requireAdmin();
  const months = parseMonths(formString(formData, "months"));

  if (months === null) {
    redirect("/admin?error=invalid-months#retention");
  }

  requireDeleteConfirmation(formData, "/admin");

  const { count } = await prisma.inquiry.deleteMany({ where: { createdAt: { lt: monthsBefore(new Date(), months) } } });
  revalidatePath("/admin");
  redirect(withParams("/admin", { success: "inquiries-purged", count: String(count) }));
}
