import { z } from "zod";
import { BOOKING_LIMITS } from "@/lib/booking-limits";
import { TIME_WINDOWS, checkBookingSlot, isValidTimeInput, storedDateFromInput, windowForTime } from "@/lib/booking-time";
import { singleLine } from "@/lib/text";

// QA-2: the booking form's options come from published Service rows.
// `value` is the service slug the form posts; `label` ("Basic - $100") is what gets stored.
export type BookingOption = { value: string; label: string };
export type BookingOptions = {
  photoPackages: BookingOption[];
  addOns: BookingOption[];
  videoServices: BookingOption[];
};

export const NO_PHOTO_PACKAGE = "No photo package selected";
export const STALE_OPTION = "That option is no longer offered. Please choose again.";

export { BOOKING_LIMITS };

const text = (max: number, tooLong = `Keep this under ${max} characters.`) => z.string().trim().max(max, tooLong);
// SEC-18: single-line fields lose line breaks and control characters (collapsed to a
// space), so they can't fake extra lines in the owner's plain-text email.
const line = (max: number, tooLong?: string) =>
  z.preprocess((value) => (typeof value === "string" ? singleLine(value) : value), text(max, tooLong));

// Multi-select values arrive comma-joined (slugs never contain commas). This keeps
// collections out of zod 3 (see SEC-9) and caps how many values are looked at.
function slugList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function squareFeetLabel(value: string) {
  const digits = value.replace(/[,\s]/g, "").replace(/sq\.?ft\.?$/i, "");
  if (!digits) return "Not provided";
  return `${Number(digits).toLocaleString("en-US")} sq ft`;
}

export function makeInquirySchema({ options, now = () => new Date() }: { options: BookingOptions; now?: () => Date }) {
  const lookup = (list: BookingOption[], value: string) => list.find((option) => option.value === value)?.label;

  return z
    .object({
      name: line(BOOKING_LIMITS.name).pipe(z.string().min(2, "Enter your name.")),
      email: line(BOOKING_LIMITS.email).pipe(z.string().email("Enter a valid email.")),
      phone: line(BOOKING_LIMITS.phone, "Enter a phone number under 30 characters.").refine(
        (value) => value.replace(/\D/g, "").length >= 10,
        "Enter a complete phone number."
      ),
      agencyName: line(BOOKING_LIMITS.agencyName).optional(),
      propertyAddress: line(BOOKING_LIMITS.propertyAddress).pipe(z.string().min(6, "Enter the property address.")),
      squareFeet: line(BOOKING_LIMITS.squareFeet)
        .optional()
        .default("")
        .refine((value) => {
          const digits = value.replace(/[,\s]/g, "").replace(/sq\.?ft\.?$/i, "");
          return !digits || (/^\d+$/.test(digits) && Number(digits) >= 100 && Number(digits) <= 100000);
        }, "Enter the approximate square footage as a number, like 1800."),
      photoPackage: text(100).optional().default(""),
      addOns: text(500).optional().default(""),
      videoService: text(500).optional().default(""),
      // Only a ticked checkbox ("on") or JSON `true` claims the offer (QA-1, LEG-4, SEC-13).
      firstShootOffer: z.preprocess((value) => value === true || value === "on", z.boolean()),
      shootType: text(120).optional().default("Listing Media Package"),
      preferredDate: text(10),
      preferredTime: text(5)
        .optional()
        .default("")
        .refine((value) => !value || isValidTimeInput(value), "Choose a time like 09:30, or leave it blank."),
      preferredWindow: z.enum(TIME_WINDOWS, { message: "Choose a time window." }).optional().default("Flexible"),
      message: text(BOOKING_LIMITS.message).pipe(z.string().min(10, "Tell us a little about the shoot."))
    })
    .superRefine((value, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

      if (value.photoPackage && !lookup(options.photoPackages, value.photoPackage)) issue("photoPackage", STALE_OPTION);
      if (slugList(value.addOns).some((slug) => !lookup(options.addOns, slug))) issue("addOns", STALE_OPTION);
      if (slugList(value.videoService).some((slug) => !lookup(options.videoServices, slug))) issue("videoService", STALE_OPTION);

      const hasPackage = Boolean(value.photoPackage);
      if (!hasPackage && !slugList(value.addOns).length && !slugList(value.videoService).length) {
        issue("services", "Please select at least one service before booking.");
      }

      // QA-17: the terms say "with any photo package".
      if (value.firstShootOffer && !hasPackage) {
        issue("firstShootOffer", "The free drone photos come with a photo package. Choose a package above or untick this box.");
      }

      const slot = checkBookingSlot({
        date: value.preferredDate,
        time: value.preferredTime,
        window: value.preferredWindow,
        now: now()
      });
      if (slot) issue(slot.field, slot.message);
    })
    .transform(({ squareFeet, ...value }) => ({
      ...value,
      propertySize: squareFeetLabel(squareFeet),
      photoPackage: lookup(options.photoPackages, value.photoPackage) ?? NO_PHOTO_PACKAGE,
      addOns: slugList(value.addOns)
        .map((slug) => lookup(options.addOns, slug))
        .join(", "),
      videoService:
        slugList(value.videoService)
          .map((slug) => lookup(options.videoServices, slug))
          .join(", ") || "None",
      preferredDate: storedDateFromInput(value.preferredDate),
      preferredTime: value.preferredTime || "Flexible",
      preferredWindow: windowForTime(value.preferredTime, value.preferredWindow)
    }));
}

export type InquiryInput = z.output<ReturnType<typeof makeInquirySchema>>;

export const serviceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-friendly slug."),
  category: z.string().trim().min(2).max(40).default("PHOTO"),
  priceLabel: z.string().trim().max(60).optional(),
  bestUse: z.string().trim().max(160).optional(),
  squareFeet: z.string().trim().max(80).optional(),
  summary: z.string().trim().min(10).max(600),
  description: z.string().trim().min(20).max(4000),
  startingAt: z.coerce.number().int().min(0),
  deliverable: z.string().trim().min(2).max(300),
  turnaround: z.string().trim().min(2).max(160),
  sortOrder: z.coerce.number().int().min(0).default(0),
  featured: z.coerce.boolean().optional().default(false),
  published: z.coerce.boolean().optional().default(false)
});

export const galleryImageSchema = z.object({
  title: z.string().trim().min(2).max(160),
  alt: z.string().trim().min(8).max(400),
  category: z.string().trim().min(2).max(60),
  imageUrl: z.string().trim().max(2048).refine((value) => {
    if (value.startsWith("/images/")) {
      return true;
    }

    try {
      const hostname = new URL(value).hostname;
      return hostname === "images.unsplash.com" || hostname.endsWith(".public.blob.vercel-storage.com");
    } catch {
      return false;
    }
  }, "Use a local /images path, images.unsplash.com URL, or uploaded Vercel Blob image."),
  width: z.coerce.number().int().min(320).default(1600),
  height: z.coerce.number().int().min(240).default(1100),
  featured: z.coerce.boolean().optional().default(false),
  published: z.coerce.boolean().optional().default(false)
});
