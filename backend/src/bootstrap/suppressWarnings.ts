/**
 * Silence the cosmetic AWS SDK v3 "NodeVersionSupportWarning" (it warns that
 * SDK releases after Jan 2027 will require Node >= 22). Harmless on Node 20.
 * This module is imported FIRST in index.ts so the filter is installed before
 * the AWS SDK is loaded.
 */
const originalEmit = process.emitWarning.bind(process);

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const text = typeof warning === "string" ? warning : warning?.message ?? "";
  const name =
    typeof warning === "object" && warning && "name" in warning ? (warning as Error).name : "";
  if (name === "NodeVersionSupportWarning" || /AWS SDK for JavaScript/i.test(text)) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (originalEmit as any)(warning, ...args);
}) as typeof process.emitWarning;
