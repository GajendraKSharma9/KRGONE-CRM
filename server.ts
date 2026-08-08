import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse large JSON payloads for images/PDFs base64
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
