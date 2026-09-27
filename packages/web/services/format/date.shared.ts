// Dates travel as ISO strings on the wire; a day label is the first ten characters.

export const formatDay = (iso: string): string => iso.slice(0, 10);

export const formatDayOrNull = (iso: string | null): string | null =>
  iso === null ? null : formatDay(iso);
