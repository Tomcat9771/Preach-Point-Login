// buildPfParamString.mjs
import crypto from 'crypto';

// URL-encode like application/x-www-form-urlencoded with PayFast quirks:
// - percent encodings must be UPPERCASE
// - spaces must be '+'
function pfEncode(v) {
  return encodeURIComponent(String(v))
    .replace(/%20/g, '+')                 // spaces as '+'
    .replace(/%[0-9a-f]{2}/g, m => m.toUpperCase()); // uppercase hex
}

// Build canonical string from all fields except 'signature', preserving insertion order.
// By default, keys with blank values are excluded. Pass { includeEmpty: true }
// to retain them as `key=` while still excluding null/undefined.
// Append passphrase LAST (only if provided).
export function buildPfParamString(fields, passphrase = '', { includeEmpty = false } = {}) {
  const parts = Object.entries(fields)
    .filter(([k, v]) => k !== 'signature' && v != null && (includeEmpty || String(v).trim() !== ''))
    .map(([k, v]) => `${k}=${pfEncode(String(v).trim())}`);

  if (passphrase && String(passphrase).trim() !== '') {
    parts.push(`passphrase=${pfEncode(String(passphrase).trim())}`);
  }
  return parts.join('&');
}

export function md5Hex(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

export function generateSignature(fields, passphrase = '', opts = {}) {
  return md5Hex(buildPfParamString(fields, passphrase, opts));
}

export function buildPfParamStringSorted(fields, passphrase = '') {
  const parts = Object.entries(fields)
    .filter(([k, v]) => k !== 'signature' && v != null && String(v).trim() !== '')
    .sort(([a], [b]) => a.localeCompare(b))                 // ← alphabetical A→Z
    .map(([k, v]) => `${k}=${pfEncode(String(v).trim())}`);

  if (passphrase && String(passphrase).trim() !== '') {
    parts.push(`passphrase=${pfEncode(String(passphrase).trim())}`);
  }
  return parts.join('&');
}

export function generateSignatureSorted(fields, passphrase = '') {
  return md5Hex(buildPfParamStringSorted(fields, passphrase));
}

export function buildPfParamStringSortedAll(fields, passphrase = '') {
  const parts = Object.entries(fields)
    .filter(([k]) => k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${pfEncode(v ?? '')}`);

  if (passphrase !== undefined && passphrase !== null) {
    parts.push(`passphrase=${pfEncode(passphrase)}`);
  }
  return parts.join('&');
}

export function generateSignatureSortedAll(fields, passphrase = '') {
  return md5Hex(buildPfParamStringSortedAll(fields, passphrase));
}