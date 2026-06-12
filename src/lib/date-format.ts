export const PERU_TIME_ZONE = "America/Lima";

export function formatPeruDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: PERU_TIME_ZONE,
  }).format(date);
}

export function formatPeruShortDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: PERU_TIME_ZONE,
  }).format(date);
}

export function peruDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: PERU_TIME_ZONE,
    year: "numeric",
  }).format(date);
}

export function parsePeruDateTimeInput(value: string) {
  const normalizedValue = value.length === 16 ? `${value}:00` : value;
  return new Date(`${normalizedValue}-05:00`);
}
