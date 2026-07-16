/** YYYY-MM-DD in the browser's local timezone (for `<input type="date">`). */
export function localDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM in the browser's local timezone (for `<input type="month">`). */
export function localMonthInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** First day of the current local month as YYYY-MM-DD. */
export function startOfLocalMonth(date = new Date()) {
  return localDateInputValue(new Date(date.getFullYear(), date.getMonth(), 1));
}
