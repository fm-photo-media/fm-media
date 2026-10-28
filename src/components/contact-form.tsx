"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { createInquiry, type FormState } from "@/app/actions";
import { BOOKING_LIMITS, NO_PACKAGE_VALUE } from "@/lib/booking-limits";
import { BUSINESS } from "@/lib/business";
import { MIN_LEAD_MINUTES, TIME_WINDOWS, chicagoWallClock, timeFitsWindow, type TimeWindow } from "@/lib/booking-time";
import { prefillFromQuery } from "@/lib/price-menu";
import { firstShootDroneOffer } from "@/lib/promotion";
import type { BookingOptions } from "@/lib/validation";

// Batch 5 restyle (design.md "Contact and booking"). Behaviour kept from batches 2-4:
// DB-driven options (QA-2), the first-shoot offer (QA-1, LEG-4), the honeypot (SEC-4,
// SEC-19), one submission key per attempt (idempotency), a synchronous double-submit guard
// (QA-10), input kept on error (QA-5), Chicago-time date and time rules (QA-3, QA-19,
// QA-20), and Legal's notice directly above the submit button (LEG-1).
// New: a native date input (keyboard and 44px, QA-11b/e), labelled controls (QA-11a), an
// error summary that takes focus and links to each bad field (QA-11c), and the price
// builder's choices pre-filled from the query string.

const initialState: FormState = { status: "idle", ok: false, message: "" };
const PHONE_DISPLAY = BUSINESS.phoneDisplay;
const PHONE_E164 = BUSINESS.phoneE164;

// The order fields appear in, for the error summary.
const FIELD_ORDER: [string, string][] = [
  ["propertyAddress", "Property address"],
  ["squareFeet", "Approx. square footage"],
  ["services", "Services"],
  ["photoPackage", "Photo package"],
  ["addOns", "Add-ons"],
  ["videoService", "Video"],
  ["firstShootOffer", "First shoot"],
  ["preferredDate", "Preferred date"],
  ["preferredTime", "Exact start time"],
  ["preferredWindow", "Time window"],
  ["name", "Name"],
  ["agencyName", "Agency"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["message", "Message"]
];

// QA-3: "today" and the 90-minute cut-off are Chicago wall-clock values.
function bookingCutoff() {
  return chicagoWallClock(new Date(Date.now() + MIN_LEAD_MINUTES * 60 * 1000));
}

function newSubmissionKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className="err">
      {message}
    </span>
  ) : null;
}

// Error wiring for a control: aria-invalid and aria-describedby (QA-5, QA-11c).
function errorProps(name: string, error?: string, hintId?: string) {
  const describedBy = [error ? `${name}-error` : null, hintId].filter(Boolean).join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined
  } as const;
}

function CallOrText() {
  return (
    <>
      Call{" "}
      <a href={"tel:" + PHONE_E164} className="fact">
        {PHONE_DISPLAY}
      </a>{" "}
      or{" "}
      <a href={"sms:" + PHONE_E164} className="fact">
        send a text
      </a>
      .
    </>
  );
}

/**
 * QA-34: some server messages end with the phone number. It's the moment the customer most
 * needs to call, so the number itself becomes the tel: link (said once), with a text link
 * on touch screens only.
 */
function MessageWithPhone({ message }: { message: string }) {
  const at = message.indexOf(PHONE_DISPLAY);
  if (at < 0) return <>{message}</>;
  return (
    <>
      {message.slice(0, at)}
      <a href={"tel:" + PHONE_E164} className="fact">
        {PHONE_DISPLAY}
      </a>
      {message.slice(at + PHONE_DISPLAY.length)}
      <span className="touch-only">
        {" "}
        <a href={"sms:" + PHONE_E164} className="fact">
          Send a text
        </a>
        .
      </span>
    </>
  );
}

export function ContactForm({ options }: { options: BookingOptions }) {
  const [state, formAction] = useActionState(createInquiry, initialState);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  // SEC-4 / QA-10: block a second submit synchronously, before React re-renders.
  const submittingRef = useRef(false);
  // One key per booking attempt; the server saves at most one inquiry per key.
  const submissionKeyRef = useRef<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  // QA-19: the window is controlled, so its error sits on the radio the customer chose.
  const [selectedWindow, setSelectedWindow] = useState<TimeWindow>("Flexible");
  const [windowNote, setWindowNote] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [minDate, setMinDate] = useState<string | undefined>(undefined);
  const cutoff = bookingCutoff();
  const minTime = selectedDate && selectedDate === cutoff.date ? cutoff.time : undefined;
  const fields = state.fields ?? {};
  const saved = state.status === "sent" || state.status === "saved-email-failed";

  // The earliest bookable day in Chicago, set after mount (no server/client mismatch).
  useEffect(() => {
    setMinDate(bookingCutoff().date);
  }, []);

  // The price builder's choices (?package=…&add=…&first=1), known slugs only.
  useEffect(() => {
    const form = formRef.current;
    if (!form || !window.location.search) return;
    const prefill = prefillFromQuery(new URLSearchParams(window.location.search), options);
    const select = form.elements.namedItem("photoPackage");
    if (prefill.photoPackage && select instanceof HTMLSelectElement) select.value = prefill.photoPackage;
    for (const slug of prefill.addOns) {
      const box = form.querySelector<HTMLInputElement>(`input[name="addOns"][value="${CSS.escape(slug)}"]`);
      if (box) box.checked = true;
    }
    for (const slug of prefill.videoServices) {
      const box = form.querySelector<HTMLInputElement>(`input[name="videoService"][value="${CSS.escape(slug)}"]`);
      if (box) box.checked = true;
    }
    const first = form.elements.namedItem("firstShootOffer");
    if (prefill.firstShoot && first instanceof HTMLInputElement) first.checked = true;
  }, [options]);

  useEffect(() => {
    if (state.status === "idle") {
      return;
    }

    submittingRef.current = false;

    if (state.ok) {
      // Saved (with or without the email): the notice replaces the form, which starts fresh.
      submissionKeyRef.current = null;
      formRef.current?.reset();
      setSelectedDate("");
      setSelectedTime("");
      setSelectedWindow("Flexible");
      setWindowNote("");
      setShowForm(false);
    }

    // QA-5 / QA-11c: inputs keep their values (the form is never reset on error). Focus
    // goes to the notice: the summary links to each bad field.
    requestAnimationFrame(() => noticeRef.current?.focus());
  }, [state]);

  useEffect(() => {
    if (minTime && selectedTime && selectedTime < minTime) {
      setSelectedTime("");
    }
  }, [minTime, selectedTime]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Submitting through startTransition (instead of the form `action`) stops
    // React from clearing every field after the action returns.
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    submissionKeyRef.current ??= newSubmissionKey();
    const formData = new FormData(event.currentTarget);
    formData.set("submissionKey", submissionKeyRef.current);
    startTransition(() => formAction(formData));
  }

  function focusField(name: string) {
    const form = formRef.current;
    if (!form) return;
    const target =
      name === "services"
        ? form.querySelector<HTMLElement>("#photoPackage")
        : (form.querySelector<HTMLElement>(`#${name}`) ?? form.querySelector<HTMLElement>(`[name="${name}"]`));
    target?.focus();
  }

  const summary = FIELD_ORDER.filter(([name]) => fields[name]);
  const servicesError = fields.photoPackage || fields.services;

  return (
    <div className="book__form" id="form" tabIndex={-1}>
      {/* One live region for the result; it takes focus when it changes. */}
      <div ref={noticeRef} tabIndex={-1} role="status" className="notice-slot">
        {state.status === "sent" ? (
          <div className="notice notice--ok">
            <b>{state.message}</b>
            <br />
            Need it sooner? <CallOrText />
          </div>
        ) : null}
        {state.status === "saved-email-failed" ? (
          <div className="notice notice--warn">
            <b>
              <MessageWithPhone message={state.message} />
            </b>
            {/* QA-30: the server message already gives the phone; add the links only if it doesn't. */}
            {state.message.includes(PHONE_DISPLAY) ? null : (
              <>
                <br />
                <CallOrText />
              </>
            )}
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="notice notice--error">
            <b>
              <MessageWithPhone message={state.message} />
            </b> {summary.length ? "Your answers are kept." : null}{" "}
            {/* QA-28: some server messages already end with the phone number; say it once. */}
            {state.message.includes(PHONE_DISPLAY) ? null : (
              <>
                Or <CallOrText />
              </>
            )}
            {summary.length ? (
              <ul className="notice__list">
                {summary.map(([name, label]) => (
                  <li key={name}>
                    <a
                      href={`#${name === "services" ? "photoPackage" : name}`}
                      onClick={(event) => {
                        event.preventDefault();
                        focusField(name);
                      }}
                    >
                      {label}: {fields[name]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {saved && !showForm ? (
        <p className="notice-again">
          <button type="button" className="btn btn--quiet" onClick={() => setShowForm(true)}>
            Send another request
          </button>
        </p>
      ) : null}

      <form ref={formRef} action={formAction} onSubmit={handleSubmit} hidden={saved && !showForm} aria-label="Booking request">
        {/* SEC-4 / SEC-19 honeypot: hidden from people and assistive tech; bots fill it.
            A neutral name and label that autofill tools don't recognise. */}
        <div aria-hidden="true" className="hp">
          <label>
            Reference note
            <input name="ref_note" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <section className="fs" aria-labelledby="f1">
          <h2 className="h3 fs__h" id="f1">
            The listing
          </h2>
          <label className="field span-2">
            <span>Property address</span>
            <input
              className="input"
              id="propertyAddress"
              name="propertyAddress"
              autoComplete="street-address"
              required
              maxLength={BOOKING_LIMITS.propertyAddress}
              {...errorProps("propertyAddress", fields.propertyAddress)}
            />
            <FieldError id="propertyAddress-error" message={fields.propertyAddress} />
          </label>
          <label className="field">
            <span>
              Approx. square footage <small>(optional)</small>
            </span>
            <input
              className="input"
              id="squareFeet"
              name="squareFeet"
              inputMode="numeric"
              placeholder="e.g. 1800"
              maxLength={BOOKING_LIMITS.squareFeet}
              {...errorProps("squareFeet", fields.squareFeet)}
            />
            <FieldError id="squareFeet-error" message={fields.squareFeet} />
          </label>
          {/* QA-11a: the select has its own label. */}
          <label className="field" htmlFor="photoPackage">
            <span>Photo package</span>
            <select
              className="input"
              id="photoPackage"
              name="photoPackage"
              defaultValue=""
              {...errorProps(fields.photoPackage ? "photoPackage" : "services", servicesError, "photoPackage-hint")}
            >
              {/* DES-26: the visible default asks for a choice; "no photos" is last and explicit. */}
              <option value="" disabled>
                Choose a package
              </option>
              {options.photoPackages.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.display ?? item.label}
                </option>
              ))}
              <option value={NO_PACKAGE_VALUE}>No photos, other services only</option>
            </select>
            <span id="photoPackage-hint" className="hint">
              Choose a package, add-ons, video, or any mix.
            </span>
            <FieldError id={fields.photoPackage ? "photoPackage-error" : "services-error"} message={servicesError} />
          </label>
          {options.addOns.length ? (
            <fieldset className="span-2 sub">
              <legend className="legend">
                Add-ons <small className="hint">(optional)</small>
              </legend>
              <div className="checks">
                {options.addOns.map((item, index) => (
                  <label key={item.value} className="check">
                    <input
                      id={index === 0 ? "addOns" : undefined}
                      name="addOns"
                      type="checkbox"
                      value={item.value}
                      {...(index === 0 ? errorProps("addOns", fields.addOns) : {})}
                    />
                    {item.display ?? item.label}
                  </label>
                ))}
              </div>
              <FieldError id="addOns-error" message={fields.addOns} />
            </fieldset>
          ) : null}
          {options.videoServices.length ? (
            <fieldset className="span-2 sub">
              <legend className="legend">
                Video <small className="hint">(optional)</small>
              </legend>
              <div className="checks">
                {options.videoServices.map((item, index) => (
                  <label key={item.value} className="check">
                    <input
                      id={index === 0 ? "videoService" : undefined}
                      name="videoService"
                      type="checkbox"
                      value={item.value}
                      {...(index === 0 ? errorProps("videoService", fields.videoService) : {})}
                    />
                    {item.display ?? item.label}
                  </label>
                ))}
              </div>
              <FieldError id="videoService-error" message={fields.videoService} />
            </fieldset>
          ) : null}
          <div className="span-2 first">
            <label className="check">
              <input id="firstShootOffer" name="firstShootOffer" type="checkbox" {...errorProps("firstShootOffer", fields.firstShootOffer)} />
              <span>
                <b>This is my first shoot with FM Media.</b>
                <br />
                <span className="hint">New clients: tick to claim free drone photos with your photo package.</span>
              </span>
            </label>
            <FieldError id="firstShootOffer-error" message={fields.firstShootOffer} />
            {/* LEG-4 / Legal R1 (round 1): the full terms are visible next to the box, never
                behind a click (promotion.ts, the same text as Terms §6). */}
            <p className="fact first__terms">{firstShootDroneOffer.terms}</p>
          </div>
        </section>

        <section className="fs" aria-labelledby="f2">
          <h2 className="h3 fs__h" id="f2">
            When
          </h2>
          <label className="field">
            <span>Preferred date</span>
            <input
              className="input"
              id="preferredDate"
              name="preferredDate"
              type="date"
              required
              min={minDate}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              {...errorProps("preferredDate", fields.preferredDate, "preferredDate-hint")}
            />
            <span id="preferredDate-hint" className="hint">
              Chicago time.
            </span>
            <FieldError id="preferredDate-error" message={fields.preferredDate} />
          </label>
          <label className="field">
            <span>
              Exact start time <small>(optional)</small>
            </span>
            <input
              className="input"
              id="preferredTime"
              name="preferredTime"
              type="time"
              min={minTime}
              value={selectedTime}
              onChange={(event) => {
                const time = event.target.value;
                setSelectedTime(time);
                if (time && !timeFitsWindow(time, selectedWindow)) {
                  setSelectedWindow("Flexible");
                  setWindowNote(`Time window set to Flexible to match ${time}.`);
                } else {
                  setWindowNote("");
                }
              }}
              {...errorProps("preferredTime", fields.preferredTime, minTime ? "preferredTime-hint" : undefined)}
            />
            {minTime ? (
              <span id="preferredTime-hint" className="hint">
                Today must be booked at least 90 minutes out (Chicago time).
              </span>
            ) : null}
            <FieldError id="preferredTime-error" message={fields.preferredTime} />
          </label>
          <fieldset className="span-2 sub">
            <legend className="legend">
              Time window <small className="hint">(optional)</small>
            </legend>
            <div className="checks checks--row">
              {TIME_WINDOWS.map((window) => (
                <label key={window} className="check">
                  <input
                    id={window === selectedWindow ? "preferredWindow" : undefined}
                    name="preferredWindow"
                    type="radio"
                    value={window}
                    checked={window === selectedWindow}
                    onChange={() => {
                      setSelectedWindow(window);
                      setWindowNote("");
                    }}
                    {...(window === selectedWindow ? errorProps("preferredWindow", fields.preferredWindow, "preferredWindow-note") : {})}
                  />
                  {window}
                </label>
              ))}
            </div>
            <FieldError id="preferredWindow-error" message={fields.preferredWindow} />
            {/* QA-20: an exact time outside the window makes the window Flexible (the server does the same). */}
            <span id="preferredWindow-note" className="hint" aria-live="polite">
              {selectedTime && !timeFitsWindow(selectedTime, selectedWindow)
                ? `${selectedTime} is outside the ${selectedWindow} window, so it will be saved as Flexible.`
                : windowNote}
            </span>
          </fieldset>
        </section>

        <section className="fs" aria-labelledby="f3">
          <h2 className="h3 fs__h" id="f3">
            You
          </h2>
          <label className="field">
            <span>Name</span>
            <input
              className="input"
              id="name"
              name="name"
              autoComplete="name"
              required
              maxLength={BOOKING_LIMITS.name}
              {...errorProps("name", fields.name)}
            />
            <FieldError id="name-error" message={fields.name} />
          </label>
          <label className="field">
            <span>
              Agency <small>(optional)</small>
            </span>
            <input
              className="input"
              id="agencyName"
              name="agencyName"
              autoComplete="organization"
              maxLength={BOOKING_LIMITS.agencyName}
              {...errorProps("agencyName", fields.agencyName)}
            />
            <FieldError id="agencyName-error" message={fields.agencyName} />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={BOOKING_LIMITS.email}
              {...errorProps("email", fields.email)}
            />
            <FieldError id="email-error" message={fields.email} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              className="input"
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={BOOKING_LIMITS.phone}
              {...errorProps("phone", fields.phone)}
            />
            <FieldError id="phone-error" message={fields.phone} />
          </label>
          <label className="field span-2">
            {/* DES-25 (round 1): optional; the length cap stays. */}
            <span>
              Message or special instructions <small>(optional)</small>
            </span>
            <textarea
              className="input"
              id="message"
              name="message"
              rows={5}
              maxLength={BOOKING_LIMITS.message}
              placeholder="Gate code, pets, vacant or occupied, deadline for the MLS"
              {...errorProps("message", fields.message)}
            />
            <FieldError id="message-error" message={fields.message} />
          </label>
        </section>

        <div className="send">
          {/* LEG-1 (batch4-copy section 1): Legal's notice, directly above the submit button. */}
          <p id="booking-notice" className="fact">
            Sending this form is a request, not a confirmed booking. We use your details only to handle your request, never for marketing.
            See our{" "}
            <Link href="/privacy" className="link tap">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="link tap">
              Terms
            </Link>
            .
          </p>
          <button type="submit" className="btn" aria-describedby="booking-notice" disabled={isPending} aria-disabled={isPending}>
            {isPending ? "Sending..." : "Send the request"}
          </button>
          <p className="fact">A request isn&apos;t a confirmed booking until Francisco confirms the time and price with you.</p>
        </div>
      </form>
    </div>
  );
}
