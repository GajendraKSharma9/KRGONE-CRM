import { GoogleGenAI, Type } from '@google/genai';
import { Business } from '../types';

export interface ExtractedLeadRecord {
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  industry: string;
  status: 'New' | 'Won' | 'Lost';
  confidenceNotes?: string;
}

export const aiExtractService = {
  // Convert File to Base64 string
  fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          data: result,
          mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        });
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  },

  // Extract records from image or PDF files via backend endpoint or client-side fallback
  async extractFromFiles(
    files: { data: string; mimeType: string }[],
    customPrompt?: string
  ): Promise<ExtractedLeadRecord[]> {
    if (!files || files.length === 0) {
      throw new Error('No images or PDF files provided for AI extraction.');
    }

    // Attempt 1: Call /api/extract-leads
    try {
      const response = await fetch('/api/extract-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files,
          customPrompt,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return this.normalizeRecords(data.records || []);
        }
      }

      // Parse error if JSON
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 405 || response.status === 404) {
        // Try Client-Side Fallback if VITE_GEMINI_API_KEY is available
        const clientApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (clientApiKey) {
          return await this.extractClientSide(files, clientApiKey, customPrompt);
        }

        throw new Error(
          `Server API returned HTTP ${response.status}. Please add 'GEMINI_API_KEY' (or 'VITE_GEMINI_API_KEY') to your Vercel Project Environment Variables and redeploy.`
        );
      }

      throw new Error(errorData.error || `Server extraction failed with status ${response.status}`);
    } catch (err: any) {
      // If network or server error, check client-side key fallback
      const clientApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (clientApiKey) {
        return await this.extractClientSide(files, clientApiKey, customPrompt);
      }
      throw err;
    }
  },

  // Client-side fallback extraction if static deployment without serverless function
  async extractClientSide(
    files: { data: string; mimeType: string }[],
    apiKey: string,
    customPrompt?: string
  ): Promise<ExtractedLeadRecord[]> {
    const ai = new GoogleGenAI({ apiKey });

    const parts: any[] = files.map((file) => ({
      inlineData: {
        data: file.data.replace(/^data:[^;]+;base64,/, ''),
        mimeType: file.mimeType || 'image/jpeg',
      },
    }));

    const systemPrompt = `You are an expert OCR & Business Document Extractor for CRM records.
Analyze the provided document image(s) or PDF page(s) (business cards, invoices, directories, contact lists, lead forms, bills, or event attendee sheets).
Extract ALL distinct business/contact records found in the document.
For each business/contact record found, extract:
- companyName: string
- contactPerson: string
- mobile: string
- email: string
- industry: string
- status: string (New, Won, or Lost)`;

    parts.push({
      text: customPrompt ? `${systemPrompt}\nUser Note: ${customPrompt}` : systemPrompt,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'List of extracted business leads/records',
          items: {
            type: Type.OBJECT,
            properties: {
              companyName: { type: Type.STRING },
              contactPerson: { type: Type.STRING },
              mobile: { type: Type.STRING },
              email: { type: Type.STRING },
              industry: { type: Type.STRING },
              status: { type: Type.STRING },
            },
            required: ['companyName'],
          },
        },
      },
    });

    const textOutput = response.text || '[]';
    let rawRecords = [];
    try {
      rawRecords = JSON.parse(textOutput);
    } catch {
      rawRecords = [];
    }
    return this.normalizeRecords(rawRecords);
  },

  normalizeRecords(rawRecords: any[]): ExtractedLeadRecord[] {
    return rawRecords.map((r: any) => ({
      companyName: (r.companyName || '').trim(),
      contactPerson: (r.contactPerson || '').trim(),
      mobile: (r.mobile || '').trim(),
      email: (r.email || '').trim(),
      industry: (r.industry || 'General').trim(),
      status: ['New', 'Won', 'Lost'].includes(r.status) ? r.status : 'New',
    }));
  },
};

