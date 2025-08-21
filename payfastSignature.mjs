// payfastSignature.mjs
import crypto from "crypto";

/** PayFast signing order (include non-empty only, in this order) */
export const PF_FIELD_ORDER = [
  "merchant_id", "merchant_key",
  "return_url", "cancel_url", "notify_url",
  "m_payment_id", "amount", "item_name",
  // optional short code: "cc","eft","dc","mp","ss","zp"
  "payment_method",
  // recurring
  "subscription_type", "billing_date", "recurring_amount", "frequency", "cycles",
];

/** Signature rule: spaces -> '+', do not percent-encode punctuation */
const enc = v => String(v).trim().replace(/ /g, "+");

/** ultra-safe URL sanitizer to remove stray spaces/NBSP/zero-width chars */
export function sanitizeUrl(u) {
  if (u == null) return u;
  return String(u)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/\u00A0/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}
export function assertCleanUrl(u, name) {
  if (!u) return;
  if (/\s|\u00A0|[\u200B-\u200D\uFEFF]/.test(u)) {
    throw new Error(`URL "${name}" contains whitespace/invisible chars: ${u}`);
  }
}

/** Build signature param string (skip empties, strict order; append passphrase only if provided) */
export function buildParamString(fields, passphrase = "") {
  const parts = [];
  for (const k of PF_FIELD_ORDER) {
    const raw = fields[k];
    if (raw === undefined || raw === null) continue;
    const s = String(raw).trim();
    if (s === "") continue;
    parts.push(`${k}=${enc(s)}`);
  }
  if (passphrase && String(passphrase).trim() !== "") {
    parts.push(`passphrase=${enc(String(passphrase).trim())}`);
  }
  return parts.join("&");
}

export function md5Hex(s) {
  return crypto.createHash("md5").update(s, "utf8").digest("hex");
}

/** Build signed fields + auto-submit HTML (sandbox by default) */
export function buildPayfastForm({
  mode = "sandbox",
  merchant_id,
  merchant_key,
  return_url,
  cancel_url,
  notify_url,
  m_payment_id,
  amount,
  item_name,
  // optional
  payment_method,          // e.g. "dc"
  subscription_type = 1,   // recurring
  billing_date,            // YYYY-MM-DD
  recurring_amount,
  frequency,               // 3 = monthly
  cycles,                  // 0 = indefinite
  passphrase = "",         // LIVE only if set in your account
}) {
  // sanitize URLs (defensive)
  return_url = sanitizeUrl(return_url);
  cancel_url = sanitizeUrl(cancel_url);
  notify_url = sanitizeUrl(notify_url);
  assertCleanUrl(return_url, "return_url");
  assertCleanUrl(cancel_url, "cancel_url");
  assertCleanUrl(notify_url, "notify_url");

  const fields = {
    merchant_id, merchant_key,
    ...(return_url ? { return_url } : {}),
    ...(cancel_url ? { cancel_url } : {}),
    ...(notify_url ? { notify_url } : {}),
    m_payment_id: String(m_payment_id),
    amount: String(amount),
    item_name: String(item_name),
    ...(payment_method ? { payment_method } : {}),
    subscription_type: String(subscription_type),
    billing_date: String(billing_date),
    recurring_amount: String(recurring_amount),
    frequency: String(frequency),
    cycles: String(cycles),
  };

  const paramStr  = buildParamString(fields, passphrase);
  const signature = md5Hex(paramStr);
  const target = mode === "live"
    ? "https://www.payfast.co.za/eng/process"
    : "https://sandbox.payfast.co.za/eng/process";

  const inputs = Object.entries(fields)
    .map(([k,v]) => `<input type="hidden" name="${k}" value="${String(v)}">`)
    .join("\n    ");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>PayFast Subscribe</title></head>
<body onload="document.forms[0].submit()">
  <!-- debug:
       ${paramStr}
       signature=${signature} -->
  <form action="${target}" method="post">
    ${inputs}
    <input type="hidden" name="signature" value="${signature}">
    <noscript><button type="submit">Continue to PayFast</button></noscript>
  </form>
</body></html>`;

  return { target, fields: { ...fields, signature }, signature, paramStr, html };
}
