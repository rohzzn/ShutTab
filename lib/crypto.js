
// PIN hashing & verification using Web Crypto
export async function sha256(bytes) {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function strToBytes(s) {
  return new TextEncoder().encode(s);
}

export function randomSalt(len = 16) {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}

export async function hashPin(pin, saltB64) {
  const pinBytes = strToBytes(pin);
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const merged = new Uint8Array(pinBytes.length + salt.length);
  merged.set(pinBytes, 0);
  merged.set(salt, pinBytes.length);
  return await sha256(merged);
}

export async function setPin(settings, newPin) {
  const salt = randomSalt(16);
  const hash = await hashPin(newPin, salt);
  settings.pin = { hash, salt };
  return settings;
}

export async function verifyPin(settings, pin) {
  if (!settings.pin || !settings.pin.hash || !settings.pin.salt) return false;
  const hash = await hashPin(pin, settings.pin.salt);
  return hash === settings.pin.hash;
}
