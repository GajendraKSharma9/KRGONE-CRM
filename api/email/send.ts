import nodemailer from "nodemailer";

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Expected POST request." });
  }

  try {
    const {
      to,
      subject,
      text,
      html,
      smtpConfig,
    } = req.body || {};

    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        error: "Recipient email (to), subject line, and email body are required.",
      });
    }

    const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.hostinger.com";
    const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
    const user = (smtpConfig?.user || process.env.SMTP_USER || "").trim();
    const pass = (smtpConfig?.pass || process.env.SMTP_PASS || "").trim();
    const fromName = (smtpConfig?.fromName || "Gajendra Sharma").trim();
    const fromEmail = (smtpConfig?.fromEmail || "gajendra.sharma@krgone.com").trim();
    const replyTo = (smtpConfig?.replyTo || fromEmail).trim();

    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        error: "Hostinger SMTP mailbox credentials not configured. Please enter your mailbox password in Email Settings.",
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 15000,
    });

    // Clean 1-to-1 executive email headers (lands in Primary Tab)
    const senderHeader = `"${fromName}" <${fromEmail}>`;
    const domainPart = fromEmail.includes("@") ? fromEmail.split("@")[1] : "krgone.com";
    const customMessageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 9)}@${domainPart}>`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: senderHeader,
      to: to.trim(),
      replyTo,
      subject: subject.trim(),
      text: text.trim(),
      messageId: customMessageId,
      date: new Date(),
    };

    if (html && html.trim()) {
      mailOptions.html = html.trim();
    }

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      messageId: info.messageId || customMessageId,
      sentFrom: senderHeader,
      sentTo: to,
    });
  } catch (err: any) {
    console.error("Vercel Serverless Hostinger SMTP send failed:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to send email through Hostinger SMTP.",
    });
  }
}
