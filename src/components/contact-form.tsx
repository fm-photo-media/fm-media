"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { createInquiry, type FormState } from "@/app/actions";
import { BOOKING_LIMITS } from "@/lib/booking-limits";
import { BUSINESS } from "@/lib/business";
import {
  MIN_LEAD_MINUTES,
  TIME_WINDOWS,
  chicagoToday,
  chicagoWallClock,
  timeFitsWindow,
  type TimeWindow
} from "@/lib/booking-time";
import type { BookingOptions } from "@/lib/validation";

const initialState: FormState = { status: "idle", ok: false, message: "" };
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PHONE_DISPLAY = BUSINESS.phoneDisplay;
const PHONE_E164 = BUSINESS.phoneE164;

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  if (!value) {
    return "Select a date";
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

// QA-3: "today" and the 90-minute cut-off are Chicago wall-clock values.
function bookingCutoff() {
  return chicagoWallClock(new Date(Date.now() + MIN_LEAD_MINUTES * 60 * 1000));
}

function formatButtonDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function newSubmissionKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm font-medium text-clay">
      {message}
    </p>
  ) : null;
}

// Error wiring for a control: aria-invalid, aria-describedby and a marker the
// form uses to focus the first error after a failed submit (QA-5, QA-11c).
function errorProps(name: string, error?: string, hintId?: string) {
  const describedBy = [error ? `${name}-error` : null, hintId].filter(Boolean).join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
    "data-error": error ? "true" : undefined
  } as const;
}

function CallOrText() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <a href={"tel:" + PHONE_E164} className="focus-ring font-semibold text-ink underline">
        Call {PHONE_DISPLAY}
      </a>
      <a href={"sms:" + PHONE_E164} className="focus-ring font-semibold text-ink underline">
        Text {PHONE_DISPLAY}
      </a>
    </p>
  );
}

function BookingCalendar({
  error,
  resetSignal,
  selectedDate,
  onSelectDate
}: {
  error?: string;
  resetSignal: number;
  selectedDate: string;
  onSelectDate: (value: string) => void;
}) {
  const today = useMemo(() => chicagoToday(new Date()), []);
  const cutoffDate = useMemo(() => bookingCutoff().date, []);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(todayYear, todayMonth - 1, 1));

  useEffect(() => {
    if (resetSignal > 0) {
      onSelectDate("");
      setVisibleMonth(new Date(todayYear, todayMonth - 1, 1));
    }
  }, [resetSignal, todayYear, todayMonth, onSelectDate]);

  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(visibleMonth);
  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const totalDays = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    const blanks = Array.from({ length: firstDay.getDay() }, () => null);
    const monthDays = Array.from({ length: totalDays }, (_, index) => {
      return new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
    });

    return [...blanks, ...monthDays];
  }, [visibleMonth]);

  function moveMonth(direction: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  return (
    <div
      id="preferredDate"
      role="group"
      aria-labelledby="preferredDate-label"
      tabIndex={-1}
      {...errorProps("preferredDate", error)}
      className="focus-ring mx-auto w-full max-w-[21rem] rounded-lg border border-line bg-mist p-3"
    >
      <input type="hidden" name="preferredDate" value={selectedDate} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p id="preferredDate-label" className="text-xs font-semibold text-ink">
            Preferred Date
          </p>
          <p className="mt-0.5 text-xs text-ink/65" aria-live="polite">
            {formatDisplayDate(selectedDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            disabled={visibleMonth.getFullYear() === todayYear && visibleMonth.getMonth() === todayMonth - 1}
            className="focus-ring grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-base leading-none text-ink disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous month"
          >
            {"<"}
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="focus-ring grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-base leading-none text-ink"
            aria-label="Next month"
          >
            {">"}
          </button>
        </div>
      </div>

      <div className="mt-3 text-center font-serif text-lg text-ink">{monthLabel}</div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-ink/50">
        {weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <span key={`blank-${index}`} className="h-8 w-8" aria-hidden="true" />;
          }

          const value = formatDateValue(date);
          const isSelected = selectedDate === value;
          // Today stays bookable while "now + 90 minutes" is still today in Chicago.
          const isPast = value < today || value < cutoffDate;
          const label = `${isSelected ? "Selected, " : ""}${formatButtonDate(date)}`;

          return (
            <button
              key={value}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(value)}
              aria-label={label}
              className={`focus-ring h-8 w-8 rounded-md text-xs font-semibold transition ${
                isSelected
                  ? "bg-ink text-white"
                  : "bg-white text-ink hover:border-clay hover:text-clay disabled:bg-transparent disabled:text-ink/25"
              }`}
              aria-pressed={isSelected}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <FieldError id="preferredDate-error" message={error} />
    </div>
  );
}

export function ContactForm({ options }: { options: BookingOptions }) {
  const [state, formAction] = useFormState(createInquiry, initialState);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  // SEC-4 / QA-10: block a second submit synchronously, before React re-renders.
  const submittingRef = useRef(false);
  // One key per booking attempt; the server saves at most one inquiry per key.
  const submissionKeyRef = useRef<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  // QA-19: the window is controlled, so its error sits on the radio the customer chose.
  const [selectedWindow, setSelectedWindow] = useState<TimeWindow>("Flexible");
  const [windowNote, setWindowNote] = useState("");
  const cutoff = bookingCutoff();
  const minTime = selectedDate && selectedDate === cutoff.date ? cutoff.time : undefined;
  const fields = state.fields ?? {};

  useEffect(() => {
    if (state.status === "idle") {
      return;
    }

    submittingRef.current = false;

    if (state.ok) {
      // Saved (with or without the email): start a fresh booking.
      submissionKeyRef.current = null;
      formRef.current?.reset();
      setSelectedDate("");
      setSelectedTime("");
      setSelectedWindow("Flexible");
      setWindowNote("");
      setResetSignal((value) => value + 1);
    }

    // QA-5 / QA-11c: inputs keep their values (the form is never auto-reset on
    // error); move focus to the first invalid control, or to the status message.
    const firstError = state.fields ? formRef.current?.querySelector<HTMLElement>('[data-error="true"]') : null;
    (firstError ?? statusRef.current)?.focus();
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

  const statusTone = state.status === "sent" ? "text-moss" : "text-clay";

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="relative grid min-w-0 gap-4 rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6"
    >
      {/* SEC-4 / SEC-19 honeypot: hidden from people and assistive tech; bots fill it.
          A neutral name and label that autofill tools don't recognise. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Reference note
          <input name="ref_note" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Name
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={BOOKING_LIMITS.name}
            {...errorProps("name", fields.name)}
            className="rounded-md border border-line px-3 py-2"
          />
          <FieldError id="name-error" message={fields.name} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Email
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={BOOKING_LIMITS.email}
            {...errorProps("email", fields.email)}
            className="rounded-md border border-line px-3 py-2"
          />
          <FieldError id="email-error" message={fields.email} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Phone
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={BOOKING_LIMITS.phone}
            {...errorProps("phone", fields.phone)}
            className="rounded-md border border-line px-3 py-2"
          />
          <FieldError id="phone-error" message={fields.phone} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Realtor / Agency Name
          <input
            id="agencyName"
            name="agencyName"
            autoComplete="organization"
            maxLength={BOOKING_LIMITS.agencyName}
            {...errorProps("agencyName", fields.agencyName)}
            className="rounded-md border border-line px-3 py-2"
          />
          <FieldError id="agencyName-error" message={fields.agencyName} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Property Address
          <input
            id="propertyAddress"
            name="propertyAddress"
            autoComplete="street-address"
            required
            maxLength={BOOKING_LIMITS.propertyAddress}
            {...errorProps("propertyAddress", fields.propertyAddress)}
            className="rounded-md border border-line px-3 py-2"
          />
          <FieldError id="propertyAddress-error" message={fields.propertyAddress} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Approx. sq ft (optional)
          <input
            id="squareFeet"
            name="squareFeet"
            inputMode="numeric"
            placeholder="e.g. 1800"
            maxLength={BOOKING_LIMITS.squareFeet}
            {...errorProps("squareFeet", fields.squareFeet)}
            className="rounded-md border border-line px-3 py-2"
          />
          <FieldError id="squareFeet-error" message={fields.squareFeet} />
        </label>
      </div>
      <BookingCalendar
        error={fields.preferredDate}
        resetSignal={resetSignal}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Preferred time window (optional)</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {TIME_WINDOWS.map((window) => (
            <label key={window} className="flex items-center gap-2 text-sm font-medium text-ink/80">
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
                className="h-4 w-4 accent-clay"
              />
              {window}
            </label>
          ))}
        </div>
        <FieldError id="preferredWindow-error" message={fields.preferredWindow} />
        {/* QA-20: an exact time outside the window makes the window Flexible (the server does the same). */}
        <p id="preferredWindow-note" className="text-xs text-ink/60" aria-live="polite">
          {selectedTime && !timeFitsWindow(selectedTime, selectedWindow)
            ? `${selectedTime} is outside the ${selectedWindow} window, so it will be saved as Flexible.`
            : windowNote}
        </p>
        <label className="grid max-w-xs gap-2 text-sm font-medium text-ink">
          Exact start time (optional)
          <input
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
            className="rounded-md border border-line px-3 py-2"
          />
          {minTime ? (
            <p id="preferredTime-hint" className="text-xs text-ink/60">
              Today must be booked at least 90 minutes out (Chicago time).
            </p>
          ) : null}
          <FieldError id="preferredTime-error" message={fields.preferredTime} />
        </label>
      </fieldset>
      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Photo Package (optional)</legend>
        <p id="photoPackage-hint" className="text-sm leading-6 text-ink/65">
          Choose a photo package, add-ons, video service, or any combination that fits the property.
        </p>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Photo package
          <select
            id="photoPackage"
            name="photoPackage"
            defaultValue=""
            {...errorProps(
              fields.photoPackage ? "photoPackage" : "services",
              fields.photoPackage || fields.services,
              "photoPackage-hint"
            )}
            className="rounded-md border border-line px-3 py-2 text-sm font-normal"
          >
            <option value="">No photo package needed</option>
            {options.photoPackages.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <FieldError id={fields.photoPackage ? "photoPackage-error" : "services-error"} message={fields.photoPackage || fields.services} />
      </fieldset>
      {options.addOns.length ? (
        <fieldset className="grid gap-3 rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Add-Ons</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {options.addOns.map((item, index) => (
              <label key={item.value} className="flex items-center gap-2 text-sm font-medium text-ink/80">
                <input
                  name="addOns"
                  type="checkbox"
                  value={item.value}
                  {...(index === 0 ? errorProps("addOns", fields.addOns) : {})}
                  className="h-4 w-4 accent-clay"
                />
                {item.label}
              </label>
            ))}
          </div>
          <FieldError id="addOns-error" message={fields.addOns} />
        </fieldset>
      ) : null}
      <div className="grid gap-2 rounded-lg border border-line bg-mist p-4 text-sm text-ink">
        <label className="flex items-start gap-3">
          <input
            id="firstShootOffer"
            name="firstShootOffer"
            type="checkbox"
            {...errorProps("firstShootOffer", fields.firstShootOffer)}
            className="mt-1 h-4 w-4 accent-clay"
          />
          <span>
            <span className="font-semibold">This is my first shoot with FM Media.</span>
            <span className="mt-1 block text-ink/70">
              New clients: tick to claim free drone photos with your photo package.
            </span>
          </span>
        </label>
        <FieldError id="firstShootOffer-error" message={fields.firstShootOffer} />
      </div>
      {options.videoServices.length ? (
        <fieldset className="grid gap-3 rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Video Services</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {options.videoServices.map((item, index) => (
              <label key={item.value} className="flex items-center gap-2 text-sm font-medium text-ink/80">
                <input
                  name="videoService"
                  type="checkbox"
                  value={item.value}
                  {...(index === 0 ? errorProps("videoService", fields.videoService) : {})}
                  className="h-4 w-4 accent-clay"
                />
                {item.label}
              </label>
            ))}
          </div>
          <FieldError id="videoService-error" message={fields.videoService} />
        </fieldset>
      ) : null}
      <label className="grid gap-2 text-sm font-medium text-ink">
        Message or Special Instructions
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={BOOKING_LIMITS.message}
          {...errorProps("message", fields.message)}
          className="rounded-md border border-line px-3 py-2"
        />
        <FieldError id="message-error" message={fields.message} />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        {/* LEG-1 (batch4-copy section 1): the notice sits directly above the submit button. */}
        <p id="booking-notice" className="w-full text-sm leading-6 text-ink/70">
          Sending this form is a request, not a confirmed booking. We use your details only to handle your request, never for
          marketing. See our{" "}
          <Link href="/privacy" className="focus-ring font-semibold text-ink underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="focus-ring font-semibold text-ink underline">
            Terms
          </Link>
          .
        </p>
        <button
          type="submit"
          aria-describedby="booking-notice"
          disabled={isPending}
          aria-disabled={isPending}
          className="focus-ring rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-clay disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Sending..." : "Request Availability"}
        </button>
        <div ref={statusRef} tabIndex={-1} role="status" className="grid gap-1 outline-none">
          {state.message ? (
            <>
              <p className={`text-sm font-medium ${statusTone}`}>{state.message}</p>
              <CallOrText />
            </>
          ) : null}
        </div>
      </div>
    </form>
  );
}
