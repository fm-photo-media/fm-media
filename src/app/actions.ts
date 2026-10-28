"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { getBookingOptions } from "@/lib/booking-options";
import { sendBookingNotification } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
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
  invalid: "Check the highlighted fields and try again.",
  rateLimited: `Too many requests from this connection. Please wait a few minutes and try again, or call or text ${CALL_OR_TEXT}.`,
  saveFailed: `Your request could not be saved. Please try again, or call or text ${CALL_OR_TEXT}.`
};

const SUBMISSION_KEY = /^[A-Za-z0-9-]{8,64}$/;

function formString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function bookingResult(emailStatus: string): FormState {
  return emailStatus === "FAILED"
    ? { status: "saved-email-failed", ok: true, message: BOOKING_MESSAGES.emailFailed }
    : { status: "sent", ok: true, message: BOOKING_MESSAGES.sent };
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function existingSubmission(submissionKey: string | null) {
  if (!submissionKey) return null;
  return prisma.inquiry.findUnique({ where: { submissionKey }, select: { emailStatus: true } }).catch(() => null);
}

function checkboxValue(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function requireDeleteConfirmation(formData: FormData) {
  if (!checkboxValue(formData, "confirmDelete")) {
    redirect("/admin?error=confirm-delete");
  }
}

function imageFileFromForm(formData: FormData) {
  const value = formData.get("imageFile");

  if (value instanceof File && value.size > 0) {
    return value;
  }

  return null;
}

function safeUploadName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function galleryImageUrlFromForm(formData: FormData, existingId?: string) {
  const file = imageFileFromForm(formData);

  if (!file) {
    const imageUrl = String(formData.get("imageUrl") ?? "").trim();

    if (imageUrl || !existingId) {
      return imageUrl;
    }

    const existing = await prisma.galleryImage.findUnique({
      where: { id: existingId },
      select: { imageUrl: true }
    });

    return existing?.imageUrl ?? "";
  }

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

  if (!allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) {
    redirect("/admin?error=invalid-image");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    redirect("/admin?error=blob-missing");
  }

  try {
    const blob = await put(`gallery/${Date.now()}-${safeUploadName(file.name)}`, file, {
      access: "public",
      addRandomSuffix: true
    });

    return blob.url;
  } catch {
    redirect("/admin?error=upload-failed");
  }
}

export async function loginAdmin(formData: FormData) {
  // SEC-4 now; batch 3 (SEC-3) builds the login throttle on the same table.
  const limit = await checkRateLimit(prisma, "login", await headers());

  if (!limit.allowed) {
    redirect("/admin/login?error=rate-limited");
  }

  const password = String(formData.get("password") ?? "");

  if (!verifyAdminPassword(password)) {
    redirect("/admin/login?error=1");
  }

  await setAdminSession();
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function createInquiry(_: FormState, formData: FormData): Promise<FormState> {
  // SEC-4: per-IP limit first, so spam and invalid floods count too.
  const limit = await checkRateLimit(prisma, "booking", await headers());

  if (!limit.allowed) {
    return { status: "error", ok: false, message: BOOKING_MESSAGES.rateLimited };
  }

  // SEC-4 honeypot: people never see or fill "website"; bots do. Pretend it worked.
  if (formString(formData, "website")) {
    console.warn("[booking] honeypot field filled; request dropped");
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

    console.error("[booking] could not save inquiry", error);
    return { status: "error", ok: false, message: BOOKING_MESSAGES.saveFailed };
  }

  // QA-4: never hide a failed notification. Flag the row for /admin and log it.
  let emailStatus = "SENT";
  let emailError: string | null = null;

  try {
    const result = await sendBookingNotification(inquiry);
    if (result.skipped) emailStatus = "SKIPPED";
  } catch (error) {
    emailStatus = "FAILED";
    emailError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    console.error(`[booking] notification email FAILED for inquiry ${inquiry.id}: ${emailError}`);
  }

  await prisma.inquiry
    .update({ where: { id: inquiry.id }, data: { emailStatus, emailError } })
    .catch((error) => console.error(`[booking] could not record email status for inquiry ${inquiry.id}`, error));

  return bookingResult(emailStatus);
}

export async function createService(formData: FormData) {
  await requireAdmin();
  const parsed = serviceSchema.safeParse({
    ...Object.fromEntries(formData),
    featured: checkboxValue(formData, "featured"),
    published: checkboxValue(formData, "published")
  });

  if (!parsed.success) {
    redirect("/admin?error=invalid-service");
  }

  await prisma.service.create({ data: parsed.data });
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/pricing");
  revalidatePath("/contact");
  revalidatePath("/admin");
}

export async function updateService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const parsed = serviceSchema.safeParse({
    ...Object.fromEntries(formData),
    featured: checkboxValue(formData, "featured"),
    published: checkboxValue(formData, "published")
  });

  if (!parsed.success) {
    redirect("/admin?error=invalid-service");
  }

  await prisma.service.update({ where: { id }, data: parsed.data });
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/pricing");
  revalidatePath("/contact");
  revalidatePath("/admin");
}

export async function deleteService(formData: FormData) {
  await requireAdmin();
  requireDeleteConfirmation(formData);
  await prisma.service.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/pricing");
  revalidatePath("/contact");
  revalidatePath("/admin");
}

export async function createGalleryImage(formData: FormData) {
  await requireAdmin();
  const parsed = galleryImageSchema.safeParse({
    ...Object.fromEntries(formData),
    imageUrl: await galleryImageUrlFromForm(formData),
    featured: checkboxValue(formData, "featured"),
    published: checkboxValue(formData, "published")
  });

  if (!parsed.success) {
    redirect("/admin/gallery?error=invalid-image");
  }

  await prisma.galleryImage.create({ data: parsed.data });
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/admin");
  redirect("/admin/gallery?success=gallery-created");
}

export async function updateGalleryImage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const parsed = galleryImageSchema.safeParse({
    ...Object.fromEntries(formData),
    imageUrl: await galleryImageUrlFromForm(formData, id),
    featured: checkboxValue(formData, "featured"),
    published: checkboxValue(formData, "published")
  });

  if (!parsed.success) {
    redirect("/admin/gallery?error=invalid-image");
  }

  await prisma.galleryImage.update({ where: { id }, data: parsed.data });
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/admin");
  redirect("/admin/gallery?success=gallery-updated");
}

export async function deleteGalleryImage(formData: FormData) {
  await requireAdmin();
  requireDeleteConfirmation(formData);
  await prisma.galleryImage.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/admin");
  redirect("/admin/gallery?success=gallery-deleted");
}

export async function updateInquiryContacted(formData: FormData) {
  await requireAdmin();

  await prisma.inquiry.update({
    where: { id: String(formData.get("id")) },
    data: {
      status: checkboxValue(formData, "contacted") ? "CONTACTED" : "NEW"
    }
  });

  revalidatePath("/admin");
}

export async function deleteInquiry(formData: FormData) {
  await requireAdmin();
  requireDeleteConfirmation(formData);
  await prisma.inquiry.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/admin");
}
