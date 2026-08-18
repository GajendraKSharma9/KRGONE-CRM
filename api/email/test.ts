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
    const { host = "smtp.hostinger.com", port = 465, secure, user, pass } = req.body || {};

    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        error: "Hostinger mailbox username (e.g. info@krgone.com) and password are required.",
      });
    }

    const isSecure = secure !== undefined ? secure : Number(port) === 465;

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: isSecure,
      auth: {
        user: user.trim(),
        pass: pass.trim(),
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    return res.status(200).json({
      success: true,
      message: `Successfully connected and authenticated with Hostinger SMTP (${user}).`,
    });
  } catch (err: any) {
    console.error("Vercel Serverless Hostinger SMTP verify failed:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to authenticate with Hostinger SMTP server. Please verify your credentials.",
    });
  }
}
