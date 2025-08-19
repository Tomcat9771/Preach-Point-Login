import crypto from 'crypto';

const PF_FIELD_ORDER = [
  "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
  "name_first", "name_last", "email_address", "cell_number",
  "m_payment_id", "amount", "item_name", "item_description",
  "custom_int1", "custom_int2", "custom_int3", "custom_int4", "custom_int5",
  "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
  "email_confirmation", "confirmation_address", "payment_method",
  "subscription_type", "billing_date", "recurring_amount", "frequency", "cycles"
];

function encodeFormComponent(str) {
  return encodeURIComponent(str).replace(/%20/g, '+');
}

export function buildPfParamString(fields, passphrase = "") {
  const parts = [];

  for (const key of PF_FIELD_ORDER) {
    const rawVal = fields[key];
    if (rawVal === undefined || rawVal === null) continue;
    const val = String(rawVal).trim();
    if (val === "") continue;
    parts.push(`${key}=${encodeFormComponent(val)}`);
  }

  if (passphrase && String(passphrase).trim()) {
    parts.push(`passphrase=${encodeFormComponent(passphrase.trim())}`);
  }

  return parts.join("&");
}

export function generateSignature(fields, passphrase = "") {
  const paramStr = buildPfParamString(fields, passphrase);
  console.log("💡 PF paramStr:", paramStr);
  return crypto.createHash("md5").update(paramStr, "utf8").digest("hex");
}
