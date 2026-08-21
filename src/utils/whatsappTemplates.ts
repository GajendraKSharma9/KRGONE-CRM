/**
 * KRGONE Sales Navigator™ - WhatsApp Message Template Engine
 * 
 * Standard Templates:
 * 1. Cold First Message (for New Leads)
 * 2. Follow-up Message (for Contacted / In-Progress Leads)
 */

export interface WhatsAppTemplateConfig {
  id: 'cold' | 'followup';
  title: string;
  badge: string;
  description: string;
  template: string;
}

export const WHATSAPP_TEMPLATES: Record<'cold' | 'followup', WhatsAppTemplateConfig> = {
  cold: {
    id: 'cold',
    title: 'Cold Outreach (First Message)',
    badge: 'COLD LEAD',
    description: 'Initial introduction and value proposition for new prospective businesses.',
    template: `Hi *{ContactName}* Ji, Gajendra here from *KRGONE*.

Have you noticed that *{CompanyName}* may be losing growth opportunities without you realizing it?

The hidden gaps could be in *sales follow-ups, customer retention, daily business processes, team performance, or CRM & automation*.

That's why we created a *FREE Business Growth Assessment* for business leaders like you.

In just 5–7 minutes, get:
➤ *Business Growth Score*
➤ *Personalized 17-page PDF Report*
➤ *Key strengths & improvement areas*

★ *100% FREE*
➤ https://www.krgone.com/business-growth-assessment

_Before deciding what your business needs next, first find out where it actually stands._`
  },
  followup: {
    id: 'followup',
    title: 'Follow-up Message',
    badge: 'FOLLOW UP',
    description: 'Nurture and re-engage previously contacted leads or scheduled follow-ups.',
    template: `Hi *{ContactName}* Ji, just following up on my earlier message.

Have you had a chance to check the *FREE Business Growth Assessment* for *{CompanyName}*?

It takes just 5–7 minutes and gives you:
➤ *Business Growth Score*
➤ *Personalized 17-page Report*
➤ *Key strengths & improvement areas*

★ *Completely FREE*
➤ https://www.krgone.com/business-growth-assessment

_It’s a simple way to identify where your business stands today—and where growth may be getting blocked._

Would you like to take the assessment?`
  }
};

/**
 * Extracts and cleans the contact person's name.
 * Handles multiple names (e.g. "Siddharth Mehta / Manoj Ghandhi"), removes titles,
 * and strips any pre-existing "Ji" so we don't end up with "Rajesh Ji Ji".
 */
export function cleanContactName(contactPerson?: string): string {
  if (!contactPerson || typeof contactPerson !== 'string') {
    return 'Sir/Madam';
  }

  let cleaned = contactPerson.trim();
  if (!cleaned || cleaned === '-' || cleaned.toUpperCase() === 'N/A') {
    return 'Sir/Madam';
  }

  // If multiple contact persons separated by / or , or &, take the primary contact
  if (cleaned.includes('/')) {
    cleaned = cleaned.split('/')[0].trim();
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  } else if (cleaned.includes('&')) {
    cleaned = cleaned.split('&')[0].trim();
  }

  // Remove trailing "Ji" or "ji" if already present
  cleaned = cleaned.replace(/\s+[jJ]i$/i, '').trim();

  // If still empty after stripping
  if (!cleaned) {
    return 'Sir/Madam';
  }

  return cleaned;
}

/**
 * Extracts and cleans the company name.
 */
export function cleanCompanyName(companyName?: string): string {
  if (!companyName || typeof companyName !== 'string') {
    return 'your business';
  }
  const cleaned = companyName.trim();
  if (!cleaned || cleaned === '-' || cleaned.toUpperCase() === 'N/A') {
    return 'your business';
  }
  return cleaned;
}

/**
 * Parses raw phone string into individual clean phone numbers.
 * Supports comma/slash/space separated phone numbers.
 * Adds '91' country code for 10-digit Indian numbers.
 */
export function parsePhoneNumbers(rawMobile?: string): Array<{ raw: string; cleaned: string }> {
  if (!rawMobile || typeof rawMobile !== 'string') {
    return [];
  }

  // Split by common delimiters: comma, slash, semicolon, or newline
  const parts = rawMobile.split(/[,/;\n|]+/).map(p => p.trim()).filter(Boolean);
  const results: Array<{ raw: string; cleaned: string }> = [];

  for (const part of parts) {
    // Keep only digits
    let digits = part.replace(/\D/g, '');

    if (!digits) continue;

    // Handle leading 0 (e.g. 09829012529 -> 9829012529)
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    // Standard 10-digit Indian number -> prefix with 91
    if (digits.length === 10) {
      digits = `91${digits}`;
    }

    // Must have at least 10 digits to be a valid phone number
    if (digits.length >= 10) {
      results.push({
        raw: part,
        cleaned: digits
      });
    }
  }

  return results;
}

/**
 * Automatically determines assigned template based on lead status:
 * - 'NEW' / 'NEW LEADS' / undefined -> 'cold'
 * - 'CONTACTED' / 'QUALIFIED' / 'PROPOSAL' / etc. -> 'followup'
 */
export function getAssignedWhatsAppTemplate(status?: string): 'cold' | 'followup' {
  if (!status) return 'cold';
  const normalized = status.trim().toUpperCase();
  if (normalized === 'NEW' || normalized === 'NEW LEADS' || normalized === 'NEW_LEAD' || normalized.startsWith('NEW')) {
    return 'cold';
  }
  return 'followup';
}

/**
 * Generates personalized message text for the given template.
 */
export function buildWhatsAppMessage(
  templateType: 'cold' | 'followup',
  contactPerson?: string,
  companyName?: string
): string {
  const templateConfig = WHATSAPP_TEMPLATES[templateType] || WHATSAPP_TEMPLATES.cold;
  const name = cleanContactName(contactPerson);
  const company = cleanCompanyName(companyName);

  return templateConfig.template
    .replace(/{ContactName}/gi, name)
    .replace(/\[\s*\*?\s*Contact\s*Name\s*\*?\s*\]/gi, name)
    .replace(/{CompanyName}/gi, company)
    .replace(/\[\s*\*?\s*Company\s*Name\s*\*?\s*\]/gi, company);
}

/**
 * Generates direct wa.me link with URL-encoded message text.
 */
export function buildWhatsAppUrl(cleanedPhone: string, message: string): string {
  if (!cleanedPhone) return '#';
  return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Calculates next follow-up date (default: +5 days).
 * Automatically shifts Sunday -> Monday to protect weekend scheduling.
 */
export function calculateNextFollowUpDate(daysToAdd: number = 5): string {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysToAdd);
  
  // If Sunday (0), push to Monday (+1 day)
  if (targetDate.getDay() === 0) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
