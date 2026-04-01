export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const padDateTimePart = (value: number) => String(value).padStart(2, "0");

export const formatDateDigitsToDisplay = (value: string) => {
  const safe = digitsOnly(value).slice(0, 8);
  if (!safe) {
    return "";
  }
  if (safe.length <= 2) {
    return safe;
  }
  if (safe.length <= 4) {
    return `${safe.slice(0, 2)}/${safe.slice(2)}`;
  }
  return `${safe.slice(0, 2)}/${safe.slice(2, 4)}/${safe.slice(4)}`;
};

export const formatTimeDigitsToDisplay = (value: string) => {
  const safe = digitsOnly(value).slice(0, 9);
  if (!safe) {
    return "";
  }
  if (safe.length <= 2) {
    return safe;
  }
  if (safe.length <= 4) {
    return `${safe.slice(0, safe.length - 2)}:${safe.slice(-2)}`;
  }
  return `${safe.slice(0, safe.length - 4)}:${safe.slice(-4, -2)}:${safe.slice(-2)}`;
};

export const displayDateToIso = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  const digits = digitsOnly(trimmed).slice(0, 8);
  if (digits.length !== 8) {
    return "";
  }
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return "";
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000) {
    return "";
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return "";
  }
  return iso;
};

export const isoToDisplayDate = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed.slice(8, 10)}/${trimmed.slice(5, 7)}/${trimmed.slice(0, 4)}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    return trimmed.replace(/-/g, "/");
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(trimmed)) {
    return `${trimmed.slice(8, 10)}/${trimmed.slice(5, 7)}/${trimmed.slice(0, 4)}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).padStart(4, "0");
  return `${day}/${month}/${year}`;
};

export const getTodayIsoDate = (nowMs = Date.now()) => {
  const current = new Date(nowMs);
  const year = current.getFullYear();
  const month = padDateTimePart(current.getMonth() + 1);
  const day = padDateTimePart(current.getDate());
  return `${year}-${month}-${day}`;
};

export const toLocalDateValue = (value: Date) =>
  `${value.getFullYear()}-${padDateTimePart(value.getMonth() + 1)}-${padDateTimePart(
    value.getDate(),
  )}`;

export const toLocalDateTimeValue = (date: Date) =>
  `${toLocalDateValue(date)}T${padDateTimePart(date.getHours())}:${padDateTimePart(
    date.getMinutes(),
  )}`;

export const parseLocalDateTimeValue = (value: string) => {
  const [datePart, timePart] = value.split("T");
  if (!datePart) {
    return { date: null as Date | null, time: "" };
  }
  const [year, month, day] = datePart.split("-").map((chunk) => Number(chunk));
  if (!year || !month || !day) {
    return { date: null as Date | null, time: "" };
  }
  return {
    date: new Date(year, month - 1, day),
    time: timePart || "",
  };
};

export const toLocalDateTimeFromIso = (value?: string | null) =>
  value ? toLocalDateTimeValue(new Date(value)) : "";

export const toTimeFieldValue = (time: string, fallback = "12:00") => {
  const [hoursPart, minutesPart] = (time || fallback).split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  const next = new Date();
  next.setHours(Number.isFinite(hours) ? hours : 12, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
};

export const displayTimeToCanonical = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  const digits = digitsOnly(trimmed).slice(0, 9);
  if (digits.length < 3) {
    return "";
  }
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (digits.length <= 4) {
    minutes = Number(digits.slice(0, digits.length - 2));
    seconds = Number(digits.slice(-2));
  } else {
    hours = Number(digits.slice(0, digits.length - 4));
    minutes = Number(digits.slice(-4, -2));
    seconds = Number(digits.slice(-2));
  }
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return "";
  }
  if (hours < 0 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return "";
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const canonicalToDisplayTime = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  let canonical = "";
  if (/^\d{1,}:\d{2}:\d{2}$/.test(trimmed)) {
    const [hoursPart, minutesPart, secondsPart] = trimmed.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);
    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes <= 59 &&
      seconds >= 0 &&
      seconds <= 59
    ) {
      canonical = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
  } else if (/^\d{1,}:\d{2}$/.test(trimmed)) {
    const [hoursPart, minutesPart] = trimmed.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes <= 59
    ) {
      canonical = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    }
  } else {
    canonical = displayTimeToCanonical(trimmed);
  }
  if (!canonical) {
    return "";
  }
  const [hoursPart, minutesPart, secondsPart] = canonical.split(":");
  const hours = Number(hoursPart);
  if (!Number.isFinite(hours)) {
    return canonical;
  }
  if (hours === 0) {
    return `${minutesPart}:${secondsPart}`;
  }
  return `${hours}:${minutesPart}:${secondsPart}`;
};

export const normalizeIsoDateFromUnknown = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed) || /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return displayDateToIso(trimmed);
  }
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = String(parsed.getFullYear()).padStart(4, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const normalizeCanonicalTimeFromUnknown = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d{1,}:\d{2}:\d{2}$/.test(trimmed)) {
    const [hoursPart, minutesPart, secondsPart] = trimmed.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);
    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes <= 59 &&
      seconds >= 0 &&
      seconds <= 59
    ) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return "";
  }
  if (/^\d{1,}:\d{2}$/.test(trimmed)) {
    const [hoursPart, minutesPart] = trimmed.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes <= 59
    ) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    }
    return "";
  }
  return displayTimeToCanonical(trimmed);
};

export const formatEpisodeReleaseDate = (dateValue?: string | null, timeValue?: string | null) => {
  const date = normalizeIsoDateFromUnknown(dateValue);
  if (!date) {
    return String(dateValue || "");
  }
  const time = normalizeCanonicalTimeFromUnknown(timeValue);
  const parsed = new Date(`${date}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsed);
  if (!time) {
    return dateLabel;
  }
  const timeLabel = canonicalToDisplayTime(time);
  if (!timeLabel) {
    return dateLabel;
  }
  return `${dateLabel} · ${timeLabel}`;
};
