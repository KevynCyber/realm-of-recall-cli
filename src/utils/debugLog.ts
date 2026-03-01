const isDebug = process.env.REALM_DEBUG === "1";

export function debugLog(context: string, error: unknown): void {
  if (!isDebug) return;
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[REALM_DEBUG] ${context}: ${msg}\n`);
}
