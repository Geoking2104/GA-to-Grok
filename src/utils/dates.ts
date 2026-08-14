/**
 * Simple helpers for relative dates used by GA4 API.
 * GA4 accepts: today, yesterday, NdaysAgo, YYYY-MM-DD
 */

export function normalizeDate(input: string): string {
  if (!input) return "7daysAgo";

  const lower = input.toLowerCase().trim();

  // Already valid relative or absolute
  if (
    lower === "today" ||
    lower === "yesterday" ||
    /^\d{4}-\d{2}-\d{2}$/.test(lower) ||
    /^\d+daysago$/.test(lower)
  ) {
    return lower;
  }

  // Friendly aliases
  const aliases: Record<string, string> = {
    "last 7 days": "7daysAgo",
    "last7days": "7daysAgo",
    "7 last days": "7daysAgo",
    "last 30 days": "30daysAgo",
    "last30days": "30daysAgo",
    "last month": "30daysAgo",
    "this month": "30daysAgo",
    "last week": "7daysAgo",
    "this week": "7daysAgo",
  };

  return aliases[lower] || input;
}
