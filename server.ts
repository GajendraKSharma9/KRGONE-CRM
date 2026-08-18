import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse large JSON payloads
  app.use(express.json({ limit: "25mb" }));

  // Helper to initialize Gemini GenAI lazily
  function getGenAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // SMTP Test Connection Endpoint
  app.post("/api/email/test", async (req, res) => {
    try {
      const { host = "smtp.hostinger.com", port = 465, secure, user, pass } = req.body;

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

      return res.json({
        success: true,
        message: `Successfully connected and authenticated with Hostinger SMTP (${user}).`,
      });
    } catch (err: any) {
      console.error("Hostinger SMTP verify failed:", err);
      return res.status(400).json({
        success: false,
        error: err.message || "Failed to authenticate with Hostinger SMTP server. Please verify your credentials.",
      });
    }
  });

  // 1-Click Automated Email Dispatch via Hostinger SMTP with High-Deliverability Headers
  app.post("/api/email/send", async (req, res) => {
    try {
      const {
        to,
        subject,
        text,
        html,
        smtpConfig,
      } = req.body;

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

      // Formulate pure 1-to-1 authentic executive email
      const senderHeader = `"${fromName}" <${fromEmail}>`;

      // Clean RFC message-id
      const domainPart = fromEmail.includes("@") ? fromEmail.split("@")[1] : "krgone.com";
      const customMessageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 9)}@${domainPart}>`;

      // Note: We intentionally DO NOT send List-Unsubscribe or bulk headers, 
      // because Gmail routes any email with List-Unsubscribe directly into the 'Promotions' tab.
      // A genuine 1-to-1 B2B email from Gajendra Sharma uses pure personal headers.
      const mailOptions: nodemailer.SendMailOptions = {
        from: senderHeader,
        to: to.trim(),
        replyTo,
        subject: subject.trim(),
        text: text.trim(),
        messageId: customMessageId,
        date: new Date(),
      };

      // Only attach HTML if explicitly provided and not empty, keeping it clean
      if (html && html.trim()) {
        mailOptions.html = html.trim();
      }

      const info = await transporter.sendMail(mailOptions);

      return res.json({
        success: true,
        messageId: info.messageId || customMessageId,
        sentFrom: senderHeader,
        sentTo: to,
      });
    } catch (err: any) {
      console.error("Hostinger SMTP send failed:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to send email through Hostinger SMTP.",
      });
    }
  });

  // API Route for AI OCR & Document Extraction (Images / Camera Photos / PDFs)
  app.post("/api/extract-leads", async (req, res) => {
    try {
      const { files, customPrompt } = req.body;

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "No files provided for extraction." });
      }

      const ai = getGenAI();

      // Build inlineData parts for each base64 file
      const parts: any[] = files.map((file: { data: string; mimeType: string }) => ({
        inlineData: {
          data: file.data.replace(/^data:[^;]+;base64,/, ""),
          mimeType: file.mimeType || "image/jpeg",
        },
      }));

      const systemPrompt = `You are an expert OCR & Business Document Extractor for CRM records.
Analyze the provided document image(s) or PDF page(s) (business cards, invoices, directories, contact lists, lead forms, bills, or event attendee sheets).
Extract ALL distinct business/contact records found in the document.
For each business/contact record found, extract:
- companyName: string (Name of company/business or person if self-employed)
- contactPerson: string (Full name of contact person, owner, or executive)
- mobile: string (Phone or mobile number)
- email: string (Email address)
- industry: string (Industry category or domain, e.g., 'Retail', 'Technology', 'Healthcare', 'Services', 'Manufacturing', 'Real Estate', 'General')
- status: string (One of 'New', 'Won', 'Lost'. Default to 'New')

If a field is missing or uncertain, provide an empty string '' or best inference for industry.
If multiple contacts/businesses are present on the same page/sheet/card, extract ALL of them into the array.`;

      parts.push({
        text: customPrompt ? `${systemPrompt}\nUser Note: ${customPrompt}` : systemPrompt,
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "List of extracted business leads/records",
            items: {
              type: Type.OBJECT,
              properties: {
                companyName: { type: Type.STRING, description: "Name of the business or company" },
                contactPerson: { type: Type.STRING, description: "Contact person or owner name" },
                mobile: { type: Type.STRING, description: "Phone/mobile number" },
                email: { type: Type.STRING, description: "Email address" },
                industry: { type: Type.STRING, description: "Industry or business domain" },
                status: { type: Type.STRING, description: "Status: New, Won, or Lost" },
              },
              required: ["companyName"],
            },
          },
        },
      });

      const textOutput = response.text || "[]";
      let records = [];
      try {
        records = JSON.parse(textOutput);
      } catch (err) {
        console.warn("Failed to parse Gemini output as JSON:", err, textOutput);
        records = [];
      }

      return res.json({ success: true, records });
    } catch (error: any) {
      console.error("Error in /api/extract-leads:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to extract business records from document.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
