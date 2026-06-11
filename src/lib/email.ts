import type { Inquiry } from "@prisma/client";

function requiredEmailEnv() {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.EMAIL_TO;

  if (process.env.NODE_ENV === "production" && (!apiKey || !from || !to)) {
    throw new Error("EMAIL_API_KEY, EMAIL_FROM, and EMAIL_TO must be configured in production.");
  }

  return { apiKey, from, to };
}

function line(label: string, value?: string | null) {
  return `${label}: ${value || "Not provided"}`;
}

export async function sendBookingNotification(inquiry: Inquiry) {
  const { apiKey, from, to } = requiredEmailEnv();

  if (!apiKey || !from || !to) {
    return { skipped: true };
  }

  const body = [
    "New Photography Booking Request",
    "",
    line("Customer name", inquiry.name),
    line("Customer email", inquiry.email),
    line("Customer phone", inquiry.phone),
    line("Realtor / agency", inquiry.agencyName),
    line("Property address", inquiry.propertyAddress),
    line("Property size", inquiry.propertySize),
    line("Photo package", inquiry.photoPackage || "No photo package selected"),
    line("Selected add-ons", inquiry.addOns || "None"),
    line("Video services", inquiry.videoService || "None"),
    line("Preferred shoot date", inquiry.preferredDate.toLocaleDateString()),
    line("Preferred shoot time", inquiry.preferredTime),
    line("Free first-shoot drone photos", inquiry.firstShootOffer ? "Yes - eligible" : "No"),
    "",
    "Message / special instructions:",
    inquiry.message
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: "New Photography Booking Request",
      text: body
    })
  });

  if (!response.ok) {
    throw new Error("Booking was saved, but the notification email could not be sent.");
  }

  return { skipped: false };
}
