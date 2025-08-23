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

// Build canonical string from ALL non-empty fields except 'signature', preserving insertion order.
// Append passphrase LAST (only if provided).
export function buildPfParamString(fields, passphrase = '') {
  const parts = Object.entries(fields)
    .filter(([k, v]) => k !== 'signature' && v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}=${pfEncode(String(v).trim())}`);

  if (passphrase && String(passphrase).trim() !== '') {
    parts.push(`passphrase=${pfEncode(String(passphrase).trim())}`);
  }
  return parts.join('&');
}

export function md5Hex(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

export function generateSignature(fields, passphrase = '') {
  return md5Hex(buildPfParamString(fields, passphrase));
}
