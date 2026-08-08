import { GoogleGenAI, Type } from "@google/genai";

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
    const { files, customPrompt } = req.body || {};

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files provided for extraction." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is missing in Vercel. Please add GEMINI_API_KEY to your Vercel Project Environment Variables.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });

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
      records = [];
    }

    return res.status(200).json({ success: true, records });
  } catch (error: any) {
    console.error("Error in Vercel Serverless /api/extract-leads:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to extract business records from document.",
    });
  }
}
