import { NextResponse } from "next/server";
import { sendBookingNotification } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { inquirySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = inquirySchema.safeParse({
    ...body,
    addOns: Array.isArray(body?.addOns) ? body.addOns.join(", ") : body?.addOns,
    videoService: Array.isArray(body?.videoService) ? body.videoService.join(", ") : body?.videoService
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid inquiry." },
      { status: 400 }
    );
  }

  const inquiry = await prisma.inquiry.create({ data: parsed.data }).catch(() => null);

  if (!inquiry) {
    return NextResponse.json(
      { error: "Booking request could not be saved. Please try again or contact us directly." },
      { status: 500 }
    );
  }

  try {
    await sendBookingNotification(inquiry);
  } catch (error) {
    return NextResponse.json(
      {
        id: inquiry.id,
        warning:
          error instanceof Error
            ? error.message
            : "Booking was saved, but the notification email could not be sent."
      },
      { status: 202 }
    );
  }

  return NextResponse.json({ id: inquiry.id }, { status: 201 });
}
