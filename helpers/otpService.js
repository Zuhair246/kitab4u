import nodemailer from 'nodemailer';

// Generate OTP
export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email (for first time)
export async function sendVerificationEmail(email, otp, context = "signup") {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    let subject = "Verify your account";
    let html = `<b>Your OTP for verifying your Email entered in KITAB4U is: <br> ${otp} </b>`;

    // Context based subject + message
    if (context === "signup") {
      subject = "Verify your account";
      html = `<b>Your OTP for verifying your Email entered in KITAB4U is: <br> ${otp} </b>`;
    } else if (context === "forgotPassword") {
      subject = "Password Reset Verification";
      html = `<b>OTP for resetting your KITAB4U password is: <br> ${otp} </b>`;
    } else if (context === "updateEmail") {
      subject = "Verify your new email";
      html = `<b>OTP for Updating your New Email in KITAB4U is: <br> ${otp} </b>`;
    }else if (context === "verifyEmail") {
      subject = "Verify your email";
      html = `<b>OTP for verifying your  Email for password reset in KITAB4U is: <br> ${otp} </b>`;
    }

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject,
      text: `Your OTP is ${otp}`,
      html,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending OTP:", error);
    return false;
  }
}

// Resend OTP email (separate subject/text)
export async function resendOtpVerification(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Resent OTP for verifying your account",
      text: `Your Re-sent OTP is ${otp}`,
      html: `<b>Resent OTP for verifying your Email entered in KITAB4U is: <br> ${otp} </b>`,
    });

    return true;
  } catch (error) {
    console.error("Error resending OTP:", error);
    return false;
  }
}
