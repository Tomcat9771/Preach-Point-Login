// generateSignature.js
import crypto from 'crypto';
import fs from 'fs';

const PF_FIELD_ORDER = [
  "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
  "name_first", "name_last", "email_address", "cell_number",
  "m_payment_id", "amount", "item_name", "item_description",
  "custom_int1", "custom_int2", "custom_int3", "custom_int4", "custom_int5",
  "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
  "email_confirmation", "confirmation_address", "payment_method",
  "subscription_type", "billing_date", "recurring_amount", "frequency", "cycles"
];

// helper for PayFast encoding
function encodeFormComponent(str) {
  return encodeURIComponent(str).replace(/%20/g, '+');
}

// generate signature
function buildPfParamString(fields, passphrase = "") {
  const parts = [];

  for (const key of PF_FIELD_ORDER) {
    const val = fields[key];
    if (val === undefined || val === null || String(val).trim() === '') continue;
    parts.push(`${key}=${encodeFormComponent(String(val).trim())}`);
  }

  if (passphrase) {
    parts.push(`passphrase=${encodeFormComponent(passphrase.trim())}`);
  }

  return parts.join('&');
}

function generateSignature(fields, passphrase = "") {
  const paramStr = buildPfParamString(fields, passphrase);
  const hash = crypto.createHash('md5').update(paramStr, 'utf8').digest('hex');
  return { signature: hash, paramStr };
}

// 🌐 Replace these with your sandbox values
const fields = {
  merchant_id: "10000100",
  merchant_key: "46f0cd694581a",
  return_url: "https://www.shieldsconsulting.co.za/subscribe/success",
  cancel_url: "https://www.shieldsconsulting.co.za/subscribe/cancel",
  notify_url: "https://preach-point-login.vercel.app/api/payfast/itn",
  name_first: "Sandbox",
  email_address: "test@example.com",
  m_payment_id: "debug_formtest_001",
  amount: "99.00",
  item_name: "Preach Point Monthly",
  subscription_type: 1,
  recurring_amount: "99.00",
  frequency: 3,
  cycles: 0,
  custom_str1: "sandbox-debug-user"
};

const passphrase = ""; // Leave empty for sandbox
const { signature, paramStr } = generateSignature(fields, passphrase);

fields.signature = signature;

console.log("\n✅ Generated Signature:", signature);
console.log("🧾 Param String:\n", paramStr);

// Write to sandbox-form.html
let inputs = Object.entries(fields).map(([key, val]) =>
  `<input type="hidden" name="${key}" value="${val}" />`
).join('\n  ');

const html = `
<form action="https://sandbox.payfast.co.za/eng/process" method="post">
  ${inputs}
  <input type="submit" value="Pay with PayFast Sandbox" />
</form>
`;

fs.writeFileSync('sandbox-form.html', html.trim());
console.log("\n✅ 'sandbox-form.html' generated. Open it in a browser to test.");
