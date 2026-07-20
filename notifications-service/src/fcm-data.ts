/** Stringify notification data for FCM (all values must be strings). */
export function toFcmDataFields(
  data: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null || value === '') continue;
    out[key] = String(value);
  }
  return out;
}
