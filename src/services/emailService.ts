/**
 * KRGONE Sales Navigator™ - Email Dispatcher Service
 * Supports Hostinger SMTP, Alias Masking (gajendra.sharma@krgone.com via info@krgone.com),
 * and dynamic per-user credentials.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string; // Authentication mailbox username (e.g. info@krgone.com)
  pass: string; // Mailbox password
  fromName: string; // Display Name (e.g. Gajendra Sharma)
  fromEmail: string; // Display Email / Alias (e.g. gajendra.sharma@krgone.com)
  replyTo?: string; // Reply-To address
  phone?: string;
}

export const DEFAULT_HOSTINGER_CONFIG: SmtpConfig = {
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  user: 'info@krgone.com',
  pass: '',
  fromName: 'Gajendra Sharma',
  fromEmail: 'gajendra.sharma@krgone.com',
  replyTo: 'gajendra.sharma@krgone.com',
  phone: '+91 7300300330'
};

const SMTP_STORAGE_KEY_PREFIX = 'krgone_smtp_config_';

export const emailService = {
  /**
   * Retrieves the SMTP configuration for the current user or falls back to organization defaults.
   */
  getSmtpConfig(userId?: string): SmtpConfig {
    try {
      const key = `${SMTP_STORAGE_KEY_PREFIX}${userId || 'default'}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return { ...DEFAULT_HOSTINGER_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse stored SMTP config:', e);
    }
    return { ...DEFAULT_HOSTINGER_CONFIG };
  },

  /**
   * Saves the SMTP configuration for the current user.
   */
  saveSmtpConfig(config: Partial<SmtpConfig>, userId?: string): SmtpConfig {
    const existing = this.getSmtpConfig(userId);
    const updated: SmtpConfig = {
      ...existing,
      ...config,
      port: Number(config.port || existing.port || 465),
      secure: config.port === 465 || config.secure !== false
    };

    try {
      const key = `${SMTP_STORAGE_KEY_PREFIX}${userId || 'default'}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save SMTP config to localStorage:', e);
    }

    return updated;
  },

  /**
   * Tests the connection with Hostinger SMTP server.
   */
  async testConnection(config: Partial<SmtpConfig>): Promise<{ success: boolean; message: string }> {
    const response = await fetch('/api/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host || 'smtp.hostinger.com',
        port: Number(config.port || 465),
        secure: config.secure !== false,
        user: config.user,
        pass: config.pass
      })
    });

    let data: any;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Server returned non-JSON response (${response.status}): ${responseText.substring(0, 100)}`);
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to authenticate with Hostinger SMTP.');
    }

    return data;
  },

  /**
   * Dispatches 1-Click Email via Hostinger SMTP.
   */
  async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    smtpConfig: SmtpConfig;
  }): Promise<{ success: boolean; messageId: string; sentFrom: string; sentTo: string }> {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        smtpConfig: params.smtpConfig
      })
    });

    let data: any;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Server returned non-JSON response (${response.status}): ${responseText.substring(0, 100)}`);
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to send email through Hostinger SMTP.');
    }

    return data;
  }
};
