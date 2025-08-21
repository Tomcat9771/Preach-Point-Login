import fs from "fs";
import crypto from "crypto";

const fields = {
  merchant_id: "10041319",
  merchant_key: "26zrknv5myxxx",
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

// Function to build parameter string
function buildParamString(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, "+")}`)
    .join("&");
}

// Function to generate signature
function generateSignature(fields) {
  const paramStr = buildParamString(fields);
  return crypto.createHash("md5").update(paramStr, "utf8").digest("hex");
}

const paramStr = buildParamString(fields);
const signature = generateSignature(fields);
fields.signature = signature;

// Build HTML form
const formHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>PayFast Sandbox Subscription</title></head>
<body>
  <h3>Debug Info</h3>
  <p><strong>Param String:</strong> ${paramStr}</p>
  <p><strong>Signature:</strong> ${signature}</p>

  <form action="https://sandbox.payfast.co.za/eng/process" method="post">
    ${Object.entries(fields)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join("\n    ")}
    <button type="submit">Subscribe via PayFast</button>
  </form>
</body>
</html>
`;

// Write to file
fs.writeFileSync("sandbox-subscribe.html", formHtml.trim());

console.log("✅ sandbox-subscribe.html has been generated with correct signature");
