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

  // Extract records from image or PDF files via backend Gemini endpoint
  async extractFromFiles(
    files: { data: string; mimeType: string }[],
    customPrompt?: string
  ): Promise<ExtractedLeadRecord[]> {
    if (!files || files.length === 0) {
      throw new Error('No images or PDF files provided for AI extraction.');
    }

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server extraction failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to extract records.');
    }

    // Clean & normalize extracted records
    const rawRecords = data.records || [];
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
