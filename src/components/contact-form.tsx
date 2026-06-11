"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createInquiry, type FormState } from "@/app/actions";

const initialState: FormState = { ok: false, message: "" };
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const photoPackages = ["Basic - $100", "Standard - $135", "Premium - $200", "Luxury - $250-$400+"];
const addOns = ["Drone Photos - $75", "Drone Video - $125", "Floor Plans - $50"];
const videoServices = ["Basic Walkthrough - $150", "Cinematic Video - $250", "Agent Intro Video - $125"];

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

function bookingCutoff() {
  return new Date(Date.now() + 90 * 60 * 1000);
}

function minimumBookingTime() {
  const cutoff = bookingCutoff();
  return `${String(cutoff.getHours()).padStart(2, "0")}:${String(cutoff.getMinutes()).padStart(2, "0")}`;
}

function cutoffDateValue() {
  return formatDateValue(bookingCutoff());
}

function formatButtonDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-clay" role="alert">
      {message}
    </p>
  ) : null;
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
  const today = useMemo(() => startOfToday(), []);
  const cutoff = useMemo(() => bookingCutoff(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    onSelectDate("");
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }, [resetSignal, today, onSelectDate]);

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
    <div className="mx-auto w-full max-w-[21rem] rounded-lg border border-line bg-mist p-3">
      <input type="text" name="preferredDate" value={selectedDate} required readOnly className="sr-only" tabIndex={-1} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink">Preferred Date</p>
          <p className="mt-0.5 text-xs text-ink/65">{formatDisplayDate(selectedDate)}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            disabled={
              visibleMonth.getFullYear() === today.getFullYear() && visibleMonth.getMonth() === today.getMonth()
            }
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
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);
          const isPast = date < today || endOfDay < cutoff;
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
      <FieldError message={error} />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="focus-ring rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-clay disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending..." : "Request Availability"}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useFormState(createInquiry, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const minTime = selectedDate && selectedDate === cutoffDateValue() ? minimumBookingTime() : undefined;

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setSelectedDate("");
      setSelectedTime("");
      setResetSignal((value) => value + 1);
    }
  }, [state.ok, state.message]);

  useEffect(() => {
    if (minTime && selectedTime && selectedTime < minTime) {
      setSelectedTime("");
    }
  }, [minTime, selectedTime]);

  return (
    <form ref={formRef} action={formAction} className="grid min-w-0 gap-4 rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Name
          <input name="name" autoComplete="name" required className="rounded-md border border-line px-3 py-2" />
          <FieldError message={state.fields?.name} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Email
          <input name="email" type="email" autoComplete="email" required className="rounded-md border border-line px-3 py-2" />
          <FieldError message={state.fields?.email} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Phone
          <input name="phone" type="tel" autoComplete="tel" required className="rounded-md border border-line px-3 py-2" />
          <FieldError message={state.fields?.phone} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Preferred Time
          <input
            name="preferredTime"
            type="time"
            required
            min={minTime}
            value={selectedTime}
            onChange={(event) => setSelectedTime(event.target.value)}
            className="rounded-md border border-line px-3 py-2"
          />
          {minTime ? <p className="text-xs text-ink/60">Today must be booked at least 90 minutes out.</p> : null}
          <FieldError message={state.fields?.preferredTime} />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium text-ink">
        Realtor / Agency Name
        <input name="agencyName" autoComplete="organization" className="rounded-md border border-line px-3 py-2" />
        <FieldError message={state.fields?.agencyName} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-ink">
        Property Address
        <input name="propertyAddress" autoComplete="street-address" required className="rounded-md border border-line px-3 py-2" />
        <FieldError message={state.fields?.propertyAddress} />
      </label>
      <BookingCalendar
        error={state.fields?.preferredDate}
        resetSignal={resetSignal}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Photo Package Optional</legend>
        <p className="text-sm leading-6 text-ink/65">
          Choose a photo package, add-ons, video service, or any combination that fits the property.
        </p>
        <select name="photoPackage" className="rounded-md border border-line px-3 py-2 text-sm">
          <option>No photo package needed</option>
          {photoPackages.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <FieldError message={state.fields?.photoPackage || state.fields?.services} />
      </fieldset>
      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Add-Ons</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {addOns.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm font-medium text-ink/80">
              <input name="addOns" type="checkbox" value={item} className="h-4 w-4 accent-clay" />
              {item}
            </label>
          ))}
        </div>
        <FieldError message={state.fields?.addOns} />
      </fieldset>
      <label className="flex items-start gap-3 rounded-lg border border-line bg-mist p-4 text-sm text-ink">
        <input name="firstShootOffer" type="checkbox" value="true" defaultChecked className="mt-1 h-4 w-4 accent-clay" />
        <span>
          <span className="font-semibold">This is my first shoot with FM Media.</span>
          <span className="mt-1 block text-ink/70">
            First-time realtor clients get drone photos included free.
          </span>
        </span>
      </label>
      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Video Services</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {videoServices.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm font-medium text-ink/80">
              <input name="videoService" type="checkbox" value={item} className="h-4 w-4 accent-clay" />
              {item}
            </label>
          ))}
        </div>
        <FieldError message={state.fields?.videoService} />
      </fieldset>
      <label className="grid gap-2 text-sm font-medium text-ink">
        Message or Special Instructions
        <textarea name="message" required rows={5} className="rounded-md border border-line px-3 py-2" />
        <FieldError message={state.fields?.message} />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton />
        {state.message ? (
          <p className={`text-sm font-medium ${state.ok ? "text-moss" : "text-clay"}`} role="status">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
