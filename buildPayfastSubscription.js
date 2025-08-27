import fs from "fs";
import crypto from "crypto";

const fields = {
  merchant_id: "14386702",
  merchant_key: "ot4o1omlggyse",
  return_url: "https://www.shieldsconsulting.co.za/subscribe/success",
  cancel_url: "https://www.shieldsconsulting.co.za/subscribe/cancel",
  notify_url: "https://preach-point-login.vercel.app/api/payfast/itn",
  m_payment_id: "sub_001",
  amount: "99.00",
  item_name: "Preach Point Monthly",
  subscription_type: "1",
  billing_date: "2025-08-30",
  recurring_amount: "99.00",
  frequency: "3",
  cycles: "0"
};

const passphrase = "Preachpoint9771";

// Function to build parameter string
function buildParamString(fields, passphrase = "") {
  const base = Object.entries(fields)
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, "+")}`)
    .join("&");
  return passphrase
    ? `${base}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
    : base;
}

// Function to generate signature
function generateSignature(fields, passphrase = "") {
  const paramStr = buildParamString(fields, passphrase);
  return crypto.createHash("md5").update(paramStr, "utf8").digest("hex");
}

const paramStr = buildParamString(fields, passphrase);
const signature = generateSignature(fields, passphrase);
fields.signature = signature;

// Build HTML form
const formHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>PayFast Subscription</title></head>
<body>
  <h3>Debug Info</h3>
  <p><strong>Param String:</strong> ${paramStr}</p>
  <p><strong>Signature:</strong> ${signature}</p>

  <form action="https://www.payfast.co.za/eng/process" method="post">
    ${Object.entries(fields)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join("\n    ")}
    <button type="submit">Subscribe via PayFast</button>
  </form>
</body>
</html>
`;

// Write to file
fs.writeFileSync("payfast-subscribe.html", formHtml.trim());

console.log("✅ payfast-subscribe.html has been generated with correct signature");
