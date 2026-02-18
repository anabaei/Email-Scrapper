require("dotenv").config();
const fs = require("fs");
const path = require("path");
const React = require("react");
const sgMail = require("@sendgrid/mail");
const { render } = require("@react-email/render");
const { OutreachEmail } = require("./email-template");

// Twilio SendGrid API key (from Twilio SendGrid / Twilio Email)
const apiKey = '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' // process.env.TWILIO_EMAIL_API_KEY;
if (apiKey) sgMail.setApiKey(apiKey);

const FROM_EMAIL = process.env.FROM_EMAIL || "paggy@twinnlinks.com";

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) {
      result.push(current.replace(/^"|"$/g, "").replace(/""/g, '"'));
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.replace(/^"|"$/g, "").replace(/""/g, '"'));
  return result;
}

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const [name = "", email = "", address = ""] = parseCsvLine(lines[i]);
    if (email && email.includes("@") && !email.includes("domain.com") && !email.includes("example.com") && !email.endsWith(".png")) {
      rows.push({ name, email, address });
    }
  }
  return rows;
}

async function sendToBusiness({ name, email, address }) {
  const html = await render(
    React.createElement(OutreachEmail, { businessName: name, businessAddress: address })
  );
  const [response] = await sgMail.send({
    to: email,
    from: FROM_EMAIL,
    subject: `Hello, ${name}`,
    html,
  });
  return { id: response.headers["x-message-id"] || response.statusCode };
}

async function main() {
  const args = process.argv.slice(2);
  const testIndex = args.indexOf("--test");
  const csvIndex = args.indexOf("--csv");
  const limitIndex = args.indexOf("--limit");

  if (!apiKey) {
    console.error("Missing SENDGRID_API_KEY or TWILIO_EMAIL_API_KEY in .env");
    process.exit(1);
  }

  if (testIndex !== -1) {
    const to = args[testIndex + 1];
    if (!to) {
      console.error("Usage: node send-email.js --test <email>");
      process.exit(1);
    }
    console.log("Sending test email to", to);
    const data = await sendToBusiness({
      name: "Test Business",
      email: to,
      address: "123 Test St, Toronto, ON",
    });
    console.log("Sent successfully:", data.id);
    return;
  }

  if (csvIndex !== -1) {
    const csvPath = path.join(__dirname, "businesses.csv");
    if (!fs.existsSync(csvPath)) {
      console.error("businesses.csv not found");
      process.exit(1);
    }
    let limit = Infinity;
    if (limitIndex !== -1 && args[limitIndex + 1]) {
      limit = parseInt(args[limitIndex + 1], 10) || 5;
    } else {
      limit = 5;
    }
    const businesses = parseCsv(csvPath).slice(0, limit);
    console.log(`Sending to ${businesses.length} businesses (limit ${limit})...`);
    for (const b of businesses) {
      try {
        const data = await sendToBusiness(b);
        console.log(`✓ ${b.name} (${b.email}) -> ${data.id}`);
      } catch (err) {
        console.error(`✗ ${b.name}:`, err.response?.body?.errors?.[0]?.message || err.message);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return;
  }

  console.log(`
Usage:
  node send-email.js --test <email>     Send a test email
  node send-email.js --csv [--limit N]  Send to businesses from businesses.csv (default limit: 5)

Set in .env:
  SENDGRID_API_KEY or TWILIO_EMAIL_API_KEY  Your Twilio SendGrid API key
  FROM_EMAIL  Verified sender (e.g. "You <noreply@yourdomain.com>")
`);
}

main().catch((err) => {
  console.error(err.response?.body || err);
  process.exit(1);
});
