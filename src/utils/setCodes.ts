/**
 * Set codes lookup utility
 * Loaded from set-codes.json generated during build
 */

interface SetCodesData {
  codeToSet: Record<string, string>;  // "BS" -> "Base Set"
  setToCode: Record<string, string>;  // "Base Set" -> "BS"
}

let setCodesData: SetCodesData | null = null;
let loadPromise: Promise<SetCodesData> | null = null;

/**
 * Load set codes data (cached after first load)
 */
export async function loadSetCodes(): Promise<SetCodesData> {
  if (setCodesData) return setCodesData;

  if (!loadPromise) {
    loadPromise = fetch('/set-codes.json')
      .then(res => res.json())
      .then(data => {
        setCodesData = data;
        return data;
      });
  }

  return loadPromise;
}

/**
 * Check if a string is a known PTCGO code (sync, returns false if not loaded yet)
 */
export function isKnownCode(code: string): boolean {
  if (!setCodesData) return false;
  return code.toUpperCase() in setCodesData.codeToSet;
}

/**
 * Get set name for a PTCGO code
 */
export function getSetForCode(code: string): string | undefined {
  if (!setCodesData) return undefined;
  return setCodesData.codeToSet[code.toUpperCase()];
}

/**
 * Get all known codes as a Set (for efficient lookup)
 */
export function getKnownCodes(): Set<string> {
  if (!setCodesData) return new Set();
  return new Set(Object.keys(setCodesData.codeToSet).map(c => c.toLowerCase()));
}
