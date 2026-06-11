"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { sendBookingNotification } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { galleryImageSchema, inquirySchema, serviceSchema } from "@/lib/validation";

export type FormState = {
  ok: boolean;
  message: string;
  fields?: Record<string, string>;
};

function checkboxValue(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function requireDeleteConfirmation(formData: FormData) {
  if (!checkboxValue(formData, "confirmDelete")) {
    redirect("/admin?error=confirm-delete");
  }
}

export async function loginAdmin(formData: FormData) {
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
  const parsed = inquirySchema.safeParse({
    ...Object.fromEntries(formData),
    addOns: formData.getAll("addOns").map(String).join(", "),
    videoService: formData.getAll("videoService").map(String).join(", ") || "None",
    firstShootOffer: checkboxValue(formData, "firstShootOffer")
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string>>((errors, issue) => {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??= issue.message;
      return errors;
    }, {});

    return {
      ok: false,
      message: "Check the highlighted fields and try again.",
      fields
    };
  }

  const inquiry = await prisma.inquiry.create({ data: parsed.data }).catch(() => null);

  if (!inquiry) {
    return {
      ok: false,
      message: "Your request could not be saved. Please try again or contact us directly."
    };
  }

  await sendBookingNotification(inquiry).catch(() => null);

  return {
    ok: true,
    message: "Thanks. Your shoot request is in, and we will follow up shortly."
  };
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
  revalidatePath("/admin");
}

export async function deleteService(formData: FormData) {
  await requireAdmin();
  requireDeleteConfirmation(formData);
  await prisma.service.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/pricing");
  revalidatePath("/admin");
}

export async function createGalleryImage(formData: FormData) {
  await requireAdmin();
  const parsed = galleryImageSchema.safeParse({
    ...Object.fromEntries(formData),
    featured: checkboxValue(formData, "featured"),
    published: checkboxValue(formData, "published")
  });

  if (!parsed.success) {
    redirect("/admin?error=invalid-image");
  }

  await prisma.galleryImage.create({ data: parsed.data });
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/admin");
}

export async function updateGalleryImage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const parsed = galleryImageSchema.safeParse({
    ...Object.fromEntries(formData),
    featured: checkboxValue(formData, "featured"),
    published: checkboxValue(formData, "published")
  });

  if (!parsed.success) {
    redirect("/admin?error=invalid-image");
  }

  await prisma.galleryImage.update({ where: { id }, data: parsed.data });
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/admin");
}

export async function deleteGalleryImage(formData: FormData) {
  await requireAdmin();
  requireDeleteConfirmation(formData);
  await prisma.galleryImage.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/admin");
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
