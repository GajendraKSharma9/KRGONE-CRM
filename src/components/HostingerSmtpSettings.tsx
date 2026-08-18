import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  KeyRound, 
  Check, 
  Server, 
  Shield, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Sparkles, 
  User, 
  Globe, 
  Phone,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Inbox
} from 'lucide-react';
import { emailService, SmtpConfig, DEFAULT_HOSTINGER_CONFIG } from '../services/emailService';
import { buildEmailHtml } from '../utils/emailTemplates';
import { UserProfile } from '../types';

interface HostingerSmtpSettingsProps {
  currentUser?: UserProfile | { uid?: string; name?: string; email?: string };
  onSaved?: (config: SmtpConfig) => void;
  compact?: boolean;
}

export const HostingerSmtpSettings: React.FC<HostingerSmtpSettingsProps> = ({
  currentUser,
  onSaved,
  compact = false
}) => {
  const userId = currentUser?.uid;
  const [config, setConfig] = useState<SmtpConfig>(() => emailService.getSmtpConfig(userId));
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Deliverability Test to Personal Inbox
  const [testEmailRecipient, setTestEmailRecipient] = useState('gajendraysharma@gmail.com');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Deliverability Guide Toggle
  const [showDeliverabilityGuide, setShowDeliverabilityGuide] = useState(false);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);

  useEffect(() => {
    const loaded = emailService.getSmtpConfig(userId);
    if (!loaded.fromName && currentUser?.name) {
      loaded.fromName = currentUser.name;
    }
    setConfig(loaded);
  }, [userId, currentUser]);

  const handleCopyRecord = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRecord(label);
    setTimeout(() => setCopiedRecord(null), 2500);
  };

  const handleTestConnection = async () => {
    if (!config.user.trim() || !config.pass.trim()) {
      setTestResult({
        success: false,
        message: 'Please enter both Hostinger mailbox (e.g. info@krgone.com) and mailbox password.'
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await emailService.testConnection(config);
      setTestResult({
        success: true,
        message: res.message || 'Hostinger SMTP connection verified successfully!'
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed. Please verify mailbox password.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSendInboxTestEmail = async () => {
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setTestEmailResult({ success: false, message: 'Please enter a valid recipient email address.' });
      return;
    }

    if (!config.user.trim() || !config.pass.trim()) {
      setTestEmailResult({ success: false, message: 'Please save your Hostinger mailbox password first.' });
      return;
    }

    setSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const testSubject = `Quick hello from Gajendra Sharma (KRGONE)`;
      const testBody = `Dear Gajendra Ji,\n\nI am sending this quick message from the KRGONE Sales Navigator to verify that our direct Hostinger SMTP delivery lands straight in the Primary Inbox.\n\nOur direct 1-to-1 executive outreach format is active without any newsletter/promotional headers.\n\nRegards,\n${config.fromName}\nKRGONE\nTurning Knowledge into Business Growth\n📞 ${config.phone || '+91 7300300330'}\n🌐 www.krgone.com\n✉ ${config.fromEmail}`;

      await emailService.sendEmail({
        to: testEmailRecipient.trim(),
        subject: testSubject,
        text: testBody,
        smtpConfig: config
      });

      setTestEmailResult({
        success: true,
        message: `✅ Direct personal test email sent to ${testEmailRecipient}! Please check your Gmail Primary Tab.`
      });
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err.message || 'Failed to dispatch test email. Please check your credentials.'
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const saved = emailService.saveSmtpConfig(config, userId);
      setConfig(saved);
      setSaveSuccess(true);
      onSaved?.(saved);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save SMTP config:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span>Hostinger 1-Click Automated Email Setup</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wide flex items-center space-x-1">
                <Shield className="w-2.5 h-2.5 text-emerald-600" />
                <span>Inbox Shield Active</span>
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Configure your Hostinger credentials to send high-deliverability emails directly from <strong className="text-slate-800">gajendra.sharma@krgone.com</strong> in 1 click.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Row 1: Sender Identity & Alias */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Display Sender Name</span>
            </label>
            <input
              type="text"
              required
              value={config.fromName}
              onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
              placeholder="e.g. Gajendra Sharma"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              <span>Sender Email (Alias / Display Address)</span>
            </label>
            <input
              type="email"
              required
              value={config.fromEmail}
              onChange={(e) => setConfig({ ...config, fromEmail: e.target.value, replyTo: e.target.value })}
              placeholder="gajendra.sharma@krgone.com"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Prospects will see this address and reply directly to your inbox.</span>
          </div>
        </div>

        {/* Row 2: Hostinger Authentication Mailbox & Password */}
        <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-900 mb-1">
            <Server className="w-4 h-4 text-purple-600" />
            <span>Hostinger Mailbox Authentication Credentials</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Main Hostinger Mailbox Username:
              </label>
              <input
                type="email"
                required
                value={config.user}
                onChange={(e) => setConfig({ ...config, user: e.target.value })}
                placeholder="info@krgone.com"
                className="w-full px-3.5 py-2 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500/20 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Your primary Hostinger account email.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hostinger Mailbox Password:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={config.pass}
                  onChange={(e) => setConfig({ ...config, pass: e.target.value })}
                  placeholder="Enter your info@krgone.com password"
                  className="w-full pl-3.5 pr-10 py-2 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Stored securely in your browser session for automated 1-click dispatch.</span>
            </div>
          </div>

          {/* Server details (auto-configured) */}
          <div className="pt-2 border-t border-purple-100 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
            <span className="font-mono">Server: <strong>smtp.hostinger.com</strong> | Port: <strong>465 (SSL)</strong></span>
            <span className="text-emerald-700 font-semibold flex items-center space-x-1">
              <Shield className="w-3 h-3 text-emerald-600" />
              <span>SPF & Return-Path Aligned</span>
            </span>
          </div>
        </div>

        {/* Feedback / Test Results */}
        {testResult && (
          <div className={`p-3 rounded-xl border text-xs flex items-center space-x-2 animate-in fade-in duration-150 ${
            testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between pt-2 gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center space-x-1.5"
          >
            {testing ? (
              <div className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-purple-600" />
            )}
            <span>{testing ? 'Verifying...' : 'Test Hostinger Auth'}</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center space-x-1.5"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? 'Saved & Active!' : 'Save Email Configuration'}</span>
          </button>
        </div>

        {/* INBOX DELIVERABILITY TEST CARD */}
        <div className="mt-5 pt-4 border-t border-slate-200">
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Inbox className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950">Send Live Deliverability Test to Your Inbox</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300">
                Inbox Verification
              </span>
            </div>
            <p className="text-[11px] text-emerald-800">
              Send a test email to your personal Gmail or Outlook inbox right now to verify it lands cleanly in the <strong>Primary Inbox</strong> with all deliverability headers intact.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="e.g. gajendraysharma@gmail.com"
                className="flex-1 min-w-[220px] px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="button"
                disabled={sendingTestEmail}
                onClick={handleSendInboxTestEmail}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-xs flex items-center space-x-1.5"
              >
                {sendingTestEmail ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Test...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Send Test Email</span>
                  </>
                )}
              </button>
            </div>

            {testEmailResult && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center space-x-2 animate-in fade-in duration-150 ${
                testEmailResult.success ? 'bg-white border-emerald-300 text-emerald-900' : 'bg-white border-red-300 text-red-900'
              }`}>
                {testEmailResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-semibold">{testEmailResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* DOMAIN HEALTH (SPF / DKIM / DMARC) ACCORDION */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDeliverabilityGuide(!showDeliverabilityGuide)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
          >
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Hostinger Domain Deliverability Checklist (SPF, DKIM, DMARC)</span>
            </div>
            {showDeliverabilityGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showDeliverabilityGuide && (
            <div className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs animate-in fade-in duration-150">
              <p className="text-[11px] text-slate-600">
                To guarantee 100% inbox placement and prevent Gmail/Outlook from putting emails in Spam, ensure these 3 DNS records are active in your <strong>Hostinger Control Panel → Emails → krgone.com → DNS / Mail Records</strong>:
              </p>

              {/* 1. SPF */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">1. SPF Record (Sender Policy Framework)</span>
                  <button
                    type="button"
                    onClick={() => handleCopyRecord('v=spf1 include:_spf.mail.hostinger.com ~all', 'spf')}
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center space-x-1"
                  >
                    {copiedRecord === 'spf' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedRecord === 'spf' ? 'Copied' : 'Copy Value'}</span>
                  </button>
                </div>
                <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                  Type: TXT | Host: @ | Value: v=spf1 include:_spf.mail.hostinger.com ~all
                </div>
              </div>

              {/* 2. DKIM */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">2. DKIM (DomainKeys Identified Mail)</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                    Hostinger Auto-Generated
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Generated automatically in Hostinger Mail panel to cryptographically sign every outgoing message.
                </p>
              </div>

              {/* 3. DMARC */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">3. DMARC Record (Mandatory for Gmail & Yahoo 2024+)</span>
                  <button
                    type="button"
                    onClick={() => handleCopyRecord('v=DMARC1; p=none; sp=none;', 'dmarc')}
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center space-x-1"
                  >
                    {copiedRecord === 'dmarc' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedRecord === 'dmarc' ? 'Copied' : 'Copy Value'}</span>
                  </button>
                </div>
                <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                  Type: TXT | Host: _dmarc | Value: v=DMARC1; p=none; sp=none;
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
