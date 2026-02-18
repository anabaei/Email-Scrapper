const React = require("react");
const { render } = require("@react-email/render");
const { OutreachEmail } = require("./email-template");

async function main() {
  const html = await render(
    React.createElement(OutreachEmail, {
      businessName: "Rebalance Sports Medicine",
      businessAddress: "110 Yonge St #905, Toronto, ON M5C 1T4, Canada",
    })
  );
  console.log(html);
}

main().catch(console.error);
