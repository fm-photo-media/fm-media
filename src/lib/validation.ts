import { z } from "zod";

function todayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export const inquirySchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name."),
    email: z.string().trim().email("Enter a valid email."),
    phone: z
      .string()
      .trim()
      .refine((value) => value.replace(/\D/g, "").length >= 10, "Enter a complete phone number."),
    agencyName: z.string().trim().optional(),
    propertyAddress: z.string().trim().min(6, "Enter the property address."),
    propertySize: z.string().trim().optional().default("Not provided"),
    photoPackage: z.string().trim().optional().default("No photo package selected"),
    addOns: z.string().trim().optional().default(""),
    videoService: z.string().trim().optional().default("None"),
    firstShootOffer: z.coerce.boolean().optional().default(false),
    shootType: z.string().trim().optional().default("Listing Media Package"),
    preferredDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
      .transform(dateFromInput)
      .refine((date) => date >= todayAtMidnight(), "Choose today or a future date."),
    preferredTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a preferred time."),
    message: z.string().trim().min(10, "Tell us a little about the shoot.")
  })
  .superRefine((value, ctx) => {
    const hasPackage =
      value.photoPackage &&
      value.photoPackage !== "No photo package needed" &&
      value.photoPackage !== "No photo package selected";
    const hasAddOns = Boolean(value.addOns?.trim());
    const hasVideo = Boolean(value.videoService?.trim() && value.videoService !== "None");

    if (!hasPackage && !hasAddOns && !hasVideo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["services"],
        message: "Please select at least one service before booking."
      });
    }

    const [hours, minutes] = value.preferredTime.split(":").map(Number);
    const scheduledAt = new Date(value.preferredDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    if (scheduledAt.getTime() < Date.now() + 90 * 60 * 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preferredTime"],
        message: "Choose a time at least 90 minutes from now."
      });
    }
  });

export const serviceSchema = z.object({
  title: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-friendly slug."),
  category: z.string().trim().min(2).default("PHOTO"),
  priceLabel: z.string().trim().optional(),
  bestUse: z.string().trim().optional(),
  squareFeet: z.string().trim().optional(),
  summary: z.string().trim().min(10),
  description: z.string().trim().min(20),
  startingAt: z.coerce.number().int().min(0),
  deliverable: z.string().trim().min(2),
  turnaround: z.string().trim().min(2),
  sortOrder: z.coerce.number().int().min(0).default(0),
  featured: z.coerce.boolean().optional().default(false),
  published: z.coerce.boolean().optional().default(false)
});

export const galleryImageSchema = z.object({
  title: z.string().trim().min(2),
  alt: z.string().trim().min(8),
  category: z.string().trim().min(2),
  imageUrl: z.string().trim().refine((value) => {
    if (value.startsWith("/images/")) {
      return true;
    }

    try {
      return new URL(value).hostname === "images.unsplash.com";
    } catch {
      return false;
    }
  }, "Use a local /images path or an images.unsplash.com URL."),
  width: z.coerce.number().int().min(320).default(1600),
  height: z.coerce.number().int().min(240).default(1100),
  featured: z.coerce.boolean().optional().default(false),
  published: z.coerce.boolean().optional().default(false)
});
