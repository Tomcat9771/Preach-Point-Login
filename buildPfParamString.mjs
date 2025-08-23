// buildPfParamString.mjs
import crypto from 'crypto';

// Field order PayFast expects for signing (include non-empty only, in this order)
export const PF_FIELD_ORDER = [
  'merchant_id', 'merchant_key',
  'return_url', 'cancel_url', 'notify_url',
  'm_payment_id', 'amount', 'item_name',
  // optional fixed method short code: cc, eft, dc, mp, ss, zp
  'payment_method',
  // recurring
  'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles',
  // optional email confirmations, custom fields etc (only if you actually include them)
  'email_confirmation', 'confirmation_address',
  'custom_int1','custom_int2','custom_int3','custom_int4','custom_int5',
  'custom_str1','custom_str2','custom_str3','custom_str4','custom_str5'
];

// Spaces → '+' for signature string; do NOT percent-encode punctuation
function enc(v) {
  return String(v).trim().replace(/ /g, '+');
}

// Build the PayFast param string in strict order, skipping empty values.
// Append passphrase ONLY if non-empty (LIVE mode with passphrase set).
export function buildPfParamString(fields, passphrase = '') {
  const parts = [];
  for (const k of PF_FIELD_ORDER) {
    const raw = fields[k];
    if (raw === undefined || raw === null) continue;
    const s = String(raw).trim();
    if (s === '') continue;
    parts.push(`${k}=${enc(s)}`);
  }
  if (passphrase && String(passphrase).trim() !== '') {
    parts.push(`passphrase=${enc(String(passphrase).trim())}`);
  }
  return parts.join('&');
}

export function md5Hex(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

// Convenience: compute signature directly from fields
export function generateSignature(fields, passphrase = '') {
  const paramStr = buildPfParamString(fields, passphrase);
  return md5Hex(paramStr);
}
