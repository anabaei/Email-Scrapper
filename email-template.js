const React = require("react");
const {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Text,
} = require("@react-email/components");

/**
 * Email template for outreach to scraped businesses.
 * Renders to HTML using @react-email/components.
 *
 * @param {Object} props
 * @param {string} props.businessName - Name of the business
 * @param {string} props.businessAddress - Address of the business
 */
function OutreachEmail({ businessName = "Business", businessAddress = "" }) {
  return React.createElement(
    Html,
    null,
    React.createElement(
      Head,
      null,
      React.createElement("meta", { charSet: "utf-8" }),
      React.createElement("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0",
      })
    ),
    React.createElement(
      Body,
      { style: { fontFamily: "Arial, sans-serif", padding: "20px" } },
      React.createElement(
        Container,
        { style: { maxWidth: "600px", margin: "0 auto" } },
        React.createElement(Heading, { as: "h1" }, `Hello, ${businessName}`),
        React.createElement(Text, null, "Your outreach message content here."),
        businessAddress &&
          React.createElement(Text, { style: { color: "#666" } }, businessAddress),
        React.createElement(
          Button,
          {
            href: "#",
            style: {
              backgroundColor: "#0070f3",
              color: "white",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            },
          },
          "Call to Action"
        )
      )
    )
  );
}

module.exports = { OutreachEmail };
