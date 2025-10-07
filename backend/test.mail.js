// test-mail.js (CommonJS)
require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err, ok) => {
  if (err) console.error("verify error", err);
  else console.log("Email server ready");
});

(async () => {
  try {
    const info = await transporter.sendMail({
      from: `"Geo-Attendance" <${process.env.EMAIL_USER}>`,
      to: "your_personal_email@domain.com",
      subject: "Test Email",
      text: "Test from backend",
    });
    console.log("Sent:", info.messageId);
  } catch (e) {
    console.error("send failed", e);
  }
})();
