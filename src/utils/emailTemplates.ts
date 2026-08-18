/**
 * KRGONE Sales Navigator™ - Professional Email Template Engine
 * 
 * Configured with KRGONE Master Positioning:
 * 1. Cold / First Email: "Exploring Business Growth Opportunities for [Company Name]"
 * 2. Follow-up Email: "Following up — KRGONE & [Company Name]"
 */

import { cleanContactName, cleanCompanyName, calculateNextFollowUpDate } from './whatsappTemplates';

export interface EmailSenderInfo {
  name?: string;
  email?: string;
  phone?: string;
}

export interface EmailTemplateConfig {
  id: 'cold' | 'followup';
  title: string;
  badge: string;
  description: string;
  defaultSubject: string;
  template: string;
}

export const DEFAULT_SENDER: EmailSenderInfo = {
  name: 'Gajendra Sharma',
  email: 'gajendra.sharma@krgone.com',
  phone: '+91 7300300330'
};

export const EMAIL_TEMPLATES: Record<'cold' | 'followup', EmailTemplateConfig> = {
  cold: {
    id: 'cold',
    title: 'Cold Outreach (First Email)',
    badge: 'COLD OUTREACH',
    description: 'Professional introduction exploring growth, sales, processes and tech value for new prospects.',
    defaultSubject: 'Exploring Business Growth Opportunities for {CompanyName}',
    template: `Dear {ContactName} Ji,

I’m {SenderName} from KRGONE. I came across {CompanyName} and wanted to introduce KRGONE and explore whether we could be of value to your business.

KRGONE helps businesses improve growth, sales, processes and technology through:

• Business Consulting & Growth
• Digital Technology
• Software & CRM Solutions
• AI & Automation

Our focus is on identifying practical opportunities to improve business performance, streamline processes and support scalable growth.

You can learn more about KRGONE here:
🌐 www.krgone.com

I wanted to understand if there is any area of your business you are currently looking to improve, automate or grow.

If relevant, I would be happy to have a brief conversation and understand your requirements.

Regards,
{SenderName}
KRGONE
Turning Knowledge into Business Growth
📞 {SenderPhone}
🌐 www.krgone.com
✉ {SenderEmail}`
  },
  followup: {
    id: 'followup',
    title: 'Follow-up Email (5–7 Days)',
    badge: 'FOLLOW UP',
    description: 'Nurture and follow up on previous communication with detailed opportunity areas.',
    defaultSubject: 'Following up — KRGONE & {CompanyName}',
    template: `Dear {ContactName} Ji,

I wanted to briefly follow up on my earlier email regarding KRGONE.

We work with businesses across Business Consulting & Growth, Digital Technology, Software & CRM Solutions, AI and Automation.

I wanted to check whether {CompanyName} is currently looking at any opportunities to:

• Improve sales or business growth
• Streamline business processes
• Implement or improve CRM/software
• Strengthen digital technology
• Explore AI or automation

If any of these areas are currently relevant, I would be happy to understand your requirement and explore how KRGONE could help.

You can also learn more about us here:
🌐 www.krgone.com

I look forward to connecting with you.

Regards,
{SenderName}
KRGONE
Turning Knowledge into Business Growth
📞 {SenderPhone}
🌐 www.krgone.com
✉ {SenderEmail}`
  }
};

/**
 * Automatically determines assigned email template based on lead status:
 * - 'NEW' / 'NEW LEADS' / undefined -> 'cold'
 * - 'CONTACTED' / 'QUALIFIED' / 'PROPOSAL' / etc. -> 'followup'
 */
export function getAssignedEmailTemplate(status?: string): 'cold' | 'followup' {
  if (!status) return 'cold';
  const normalized = status.trim().toUpperCase();
  if (normalized === 'NEW' || normalized === 'NEW LEADS' || normalized === 'NEW_LEAD' || normalized.startsWith('NEW')) {
    return 'cold';
  }
  return 'followup';
}

/**
 * Generates subject line for email.
 */
export function buildEmailSubject(
  templateType: 'cold' | 'followup',
  companyName?: string
): string {
  const config = EMAIL_TEMPLATES[templateType] || EMAIL_TEMPLATES.cold;
  const company = cleanCompanyName(companyName);
  return config.defaultSubject.replace(/{CompanyName}/g, company);
}

/**
 * Generates personalized plain-text email body.
 */
export function buildEmailBody(
  templateType: 'cold' | 'followup',
  contactPerson?: string,
  companyName?: string,
  sender?: EmailSenderInfo
): string {
  const config = EMAIL_TEMPLATES[templateType] || EMAIL_TEMPLATES.cold;
  const contact = cleanContactName(contactPerson);
  const company = cleanCompanyName(companyName);

  const senderName = (sender?.name && sender.name.trim()) || DEFAULT_SENDER.name!;
  const senderEmail = (sender?.email && sender.email.trim()) || DEFAULT_SENDER.email!;
  const senderPhone = (sender?.phone && sender.phone.trim()) || DEFAULT_SENDER.phone!;

  return config.template
    .replace(/{ContactName}/g, contact)
    .replace(/{CompanyName}/g, company)
    .replace(/{SenderName}/g, senderName)
    .replace(/{SenderEmail}/g, senderEmail)
    .replace(/{SenderPhone}/g, senderPhone);
}

/**
 * Generates clean, authentic HTML layout (styled to look 100% human-crafted for maximum Primary Inbox deliverability).
 */
export function buildEmailHtml(
  templateType: 'cold' | 'followup',
  contactPerson?: string,
  companyName?: string,
  sender?: EmailSenderInfo
): string {
  const contact = cleanContactName(contactPerson);
  const company = cleanCompanyName(companyName);
  const senderName = (sender?.name && sender.name.trim()) || DEFAULT_SENDER.name!;
  const senderEmail = (sender?.email && sender.email.trim()) || DEFAULT_SENDER.email!;
  const senderPhone = (sender?.phone && sender.phone.trim()) || DEFAULT_SENDER.phone!;

  if (templateType === 'cold') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14.5px; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #ffffff;">
  <div style="max-width: 600px; padding: 12px 0;">
    <p style="margin: 0 0 14px 0;">Dear ${contact} Ji,</p>
    
    <p style="margin: 0 0 14px 0;">I’m <strong>${senderName}</strong> from <strong>KRGONE</strong>. I came across <strong>${company}</strong> and wanted to introduce KRGONE and explore whether we could be of value to your business.</p>
    
    <p style="margin: 0 0 10px 0;">KRGONE helps businesses improve growth, sales, processes and technology through:</p>
    
    <ul style="margin: 0 0 16px 0; padding-left: 22px; color: #0f172a;">
      <li style="margin-bottom: 5px;"><strong>Business Consulting & Growth</strong></li>
      <li style="margin-bottom: 5px;"><strong>Digital Technology</strong></li>
      <li style="margin-bottom: 5px;"><strong>Software & CRM Solutions</strong></li>
      <li style="margin-bottom: 5px;"><strong>AI & Automation</strong></li>
    </ul>
    
    <p style="margin: 0 0 14px 0;">Our focus is on identifying practical opportunities to improve business performance, streamline processes and support scalable growth.</p>
    
    <p style="margin: 0 0 14px 0;">You can learn more about KRGONE here:<br>
      🌐 <a href="https://www.krgone.com" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">www.krgone.com</a>
    </p>
    
    <p style="margin: 0 0 14px 0;">I wanted to understand if there is any area of your business you are currently looking to improve, automate or grow.</p>
    
    <p style="margin: 0 0 20px 0;">If relevant, I would be happy to have a brief conversation and understand your requirements.</p>
    
    <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #334155; font-size: 13.5px; line-height: 1.5;">
      <p style="margin: 0 0 3px 0; font-weight: bold; color: #0f172a; font-size: 14.5px;">Regards,</p>
      <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f172a;">${senderName}</p>
      <p style="margin: 0 0 2px 0; font-weight: 600; color: #475569;">KRGONE</p>
      <p style="margin: 0 0 8px 0; font-style: italic; color: #64748b;">Turning Knowledge into Business Growth</p>
      <p style="margin: 0 0 3px 0;">📞 <a href="tel:${senderPhone.replace(/[^0-9+]/g, '')}" style="color: #334155; text-decoration: none;">${senderPhone}</a></p>
      <p style="margin: 0 0 3px 0;">🌐 <a href="https://www.krgone.com" target="_blank" style="color: #2563eb; text-decoration: none;">www.krgone.com</a></p>
      <p style="margin: 0 0 0 0;">✉ <a href="mailto:${senderEmail}" style="color: #334155; text-decoration: none;">${senderEmail}</a></p>
    </div>
  </div>
</body>
</html>`;
  }

  // Followup HTML
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14.5px; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #ffffff;">
  <div style="max-width: 600px; padding: 12px 0;">
    <p style="margin: 0 0 14px 0;">Dear ${contact} Ji,</p>
    
    <p style="margin: 0 0 14px 0;">I wanted to briefly follow up on my earlier email regarding KRGONE.</p>
    
    <p style="margin: 0 0 14px 0;">We work with businesses across <strong>Business Consulting & Growth</strong>, <strong>Digital Technology</strong>, <strong>Software & CRM Solutions</strong>, <strong>AI and Automation</strong>.</p>
    
    <p style="margin: 0 0 10px 0;">I wanted to check whether <strong>${company}</strong> is currently looking at any opportunities to:</p>
    
    <ul style="margin: 0 0 16px 0; padding-left: 22px; color: #0f172a;">
      <li style="margin-bottom: 5px;">Improve sales or business growth</li>
      <li style="margin-bottom: 5px;">Streamline business processes</li>
      <li style="margin-bottom: 5px;">Implement or improve CRM/software</li>
      <li style="margin-bottom: 5px;">Strengthen digital technology</li>
      <li style="margin-bottom: 5px;">Explore AI or automation</li>
    </ul>
    
    <p style="margin: 0 0 14px 0;">If any of these areas are currently relevant, I would be happy to understand your requirement and explore how KRGONE could help.</p>
    
    <p style="margin: 0 0 14px 0;">You can also learn more about us here:<br>
      🌐 <a href="https://www.krgone.com" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">www.krgone.com</a>
    </p>
    
    <p style="margin: 0 0 20px 0;">I look forward to connecting with you.</p>
    
    <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #334155; font-size: 13.5px; line-height: 1.5;">
      <p style="margin: 0 0 3px 0; font-weight: bold; color: #0f172a; font-size: 14.5px;">Regards,</p>
      <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f172a;">${senderName}</p>
      <p style="margin: 0 0 2px 0; font-weight: 600; color: #475569;">KRGONE</p>
      <p style="margin: 0 0 8px 0; font-style: italic; color: #64748b;">Turning Knowledge into Business Growth</p>
      <p style="margin: 0 0 3px 0;">📞 <a href="tel:${senderPhone.replace(/[^0-9+]/g, '')}" style="color: #334155; text-decoration: none;">${senderPhone}</a></p>
      <p style="margin: 0 0 3px 0;">🌐 <a href="https://www.krgone.com" target="_blank" style="color: #2563eb; text-decoration: none;">www.krgone.com</a></p>
      <p style="margin: 0 0 0 0;">✉ <a href="mailto:${senderEmail}" style="color: #334155; text-decoration: none;">${senderEmail}</a></p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates mailto URL with prefilled to, subject and body.
 */
export function buildMailtoUrl(
  toEmail: string,
  subject: string,
  body: string
): string {
  if (!toEmail) return '#';
  return `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Generates direct Gmail web compose URL with prefilled to, subject and body.
 */
export function buildGmailComposeUrl(
  toEmail: string,
  subject: string,
  body: string
): string {
  if (!toEmail) return 'https://mail.google.com';
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Generates Hostinger Webmail URL.
 */
export function getHostingerWebmailUrl(): string {
  return 'https://mail.hostinger.com';
}
