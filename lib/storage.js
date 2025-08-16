
// Simple wrapper around chrome.storage with schema defaults and migration
export const DEFAULT_SETTINGS = {
  enabled: true,
  allowlistMode: false,
  defaultBlockMode: "hard", // "hard" | "soft"
  requirePinForChanges: false,
  defaultOverrideMinutes: [5, 15, 30],
  rules: [], // array of Rule
  pin: { hash: null, salt: null }, // sha256 + random salt (base64)
  overrides: {}, // { [hostname]: epochMs }
  log: [] // last 100 events
};

export async function getAll() {
  const obj = await chrome.storage.sync.get("settings");
  const local = await chrome.storage.local.get("settings"); // fallback store
  // prefer sync if present, else local
  const stored = obj.settings || local.settings || {};
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  // fill missing nested fields
  if (!merged.defaultOverrideMinutes) merged.defaultOverrideMinutes = [5, 15, 30];
  if (!merged.pin) merged.pin = { hash: null, salt: null };
  if (!merged.overrides) merged.overrides = {};
  if (!Array.isArray(merged.rules)) merged.rules = [];
  if (!Array.isArray(merged.log)) merged.log = [];
  return merged;
}

export async function saveAll(settings) {
  try {
    await chrome.storage.sync.set({ settings });
  } catch (e) {
    // fallback if sync quota exceeded or unavailable
    await chrome.storage.local.set({ settings });
  }
}

export async function pushLog(entry) {
  const settings = await getAll();
  const log = settings.log || [];
  log.unshift({ time: Date.now(), ...entry });
  settings.log = log.slice(0, 100);
  await saveAll(settings);
}

export async function clearExpiredOverrides() {
  const settings = await getAll();
  const now = Date.now();
  let changed = false;
  for (const host of Object.keys(settings.overrides)) {
    if (settings.overrides[host] <= now) {
      delete settings.overrides[host];
      changed = true;
    }
  }
  if (changed) await saveAll(settings);
  return changed;
}
