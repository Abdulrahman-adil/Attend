const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const emailEnabled = process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS;
const adminEmail = process.env.ADMIN_EMAIL;

if (!emailEnabled) {
  console.warn(`
    *****************************************************************
    * WARNING: Email service is not configured.                     *
    * Please set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env file. *
    * Emails will not be sent.                                      *
    *****************************************************************
  `);
}

const transporter = emailEnabled ? nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: (process.env.EMAIL_PORT || 587) == 465,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
}) : null;

const sendActivationEmail = async (to, token) => {
  if (!transporter) return;
  const activationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/activate/${token}`;
  const mailOptions = {
    from: `"Geo-Attendance Pro" <${process.env.EMAIL_USER}>`, to, subject: 'Activate Your Geo-Attendance Pro Account',
    html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2>Welcome to Geo-Attendance Pro!</h2>
        <p>Thank you for registering. Please click the button below to activate your account:</p>
        <a href="${activationUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Activate Account</a>
        <p>This link will expire in 1 hour.</p></div>`,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Activation email sent to ${to}`);
  } catch (error) {
    console.error(`Error sending activation email to ${to}:`, error);
  }
};

const sendEmployeeCredentialsEmail = async (to, password,token) => {
    if (!transporter) return;
    const name = to.split('@')[0];
    const activationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/activate/${token}`;
    const mailOptions = {
      from: `"Geo-Attendance Pro" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Your Geo-Attendance Pro Account Credentials",
      html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2>Welcome to the Team!</h2>
        <p>A Company Owner has created an account for you on Geo-Attendance Pro.</p>
        <p>You can log in using the following credentials after activating your account:</p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Temporary Password:</strong> ${password}</li>
        </ul>
        <p>Please activate your account by clicking the button below:</p>
        <a href="${activationUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Activate Account
        </a>
        <p>This link will expire in 1 hour.</p>
      </div>
    `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Credentials email sent to ${to}`);
    } catch (error) {
        console.error(`Error sending credentials email to ${to}:`, error);
    }
};

const sendAttendanceNotificationEmail = async (managerEmail, employeeName, action, time) => {
    if (!transporter) return;
    const formattedTime = new Date(time).toLocaleString();
    const mailOptions = {
        from: `"Geo-Attendance Pro" <${process.env.EMAIL_USER}>`, to: managerEmail, subject: `Attendance Alert: ${employeeName} has ${action}`,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2>Attendance Notification</h2>
            <p>This is an automated notification to inform you of an attendance event.</p>
            <ul><li><strong>Employee:</strong> ${employeeName}</li><li><strong>Action:</strong> ${action}</li><li><strong>Time:</strong> ${formattedTime}</li></ul>
            <p>You can view detailed attendance records in your dashboard.</p></div>`,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Attendance notification for ${employeeName} sent to ${managerEmail}`);
    } catch (error) {
        console.error(`Error sending attendance notification to ${managerEmail}:`, error);
    }
};

const sendAdminRegistrationNotification = async (userName, userEmail) => {
    if (!transporter || !adminEmail) {
        if (!adminEmail) console.log("Admin email not configured, skipping new user notification.");
        return;
    };
    const mailOptions = {
        from: `"Geo-Attendance Pro System" <${process.env.EMAIL_USER}>`, to: adminEmail, subject: `New User Registration: ${userName}`,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2>New User Notification</h2>
            <p>A new user has registered on Geo-Attendance Pro.</p>
            <ul><li><strong>Name:</strong> ${userName}</li><li><strong>Email:</strong> ${userEmail}</li></ul>
        </div>`,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Admin notification for new user ${userName} sent to ${adminEmail}`);
    } catch (error) {
        console.error(`Error sending admin notification email:`, error);
    }
};

module.exports = {
  sendActivationEmail,
  sendEmployeeCredentialsEmail,
  sendAttendanceNotificationEmail,
  sendAdminRegistrationNotification,
};
