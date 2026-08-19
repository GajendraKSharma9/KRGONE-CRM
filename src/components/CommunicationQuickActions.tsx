import React, { useState, useRef, useEffect } from 'react';
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  Plus, 
  ChevronDown, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Repeat, 
  Eye, 
  X,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  Globe,
  Settings as SettingsIcon,
  Shield,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import {
  cleanContactName,
  cleanCompanyName,
  parsePhoneNumbers,
  getAssignedWhatsAppTemplate,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  calculateNextFollowUpDate
} from '../utils/whatsappTemplates';
import {
  getAssignedEmailTemplate,
  buildEmailSubject,
  buildEmailBody,
  buildEmailHtml,
  buildMailtoUrl,
  buildGmailComposeUrl,
  getHostingerWebmailUrl,
  DEFAULT_SENDER,
  EmailSenderInfo
} from '../utils/emailTemplates';
import { Business, Activity, UserProfile } from '../types';
import { activityService } from '../services/activityService';
import { businessService } from '../services/businessService';
import { emailService, SmtpConfig } from '../services/emailService';
import { HostingerSmtpSettings } from './HostingerSmtpSettings';

interface CommunicationQuickActionsProps {
  business?: Business;
  currentUser?: UserProfile | { uid?: string; name?: string; email?: string; organizationId?: string; phone?: string };
  mobile?: string;
  email?: string;
  contactPerson?: string;
  companyName?: string;
  leadStatus?: string;
  onLogActivity?: () => void;
  onBusinessUpdated?: (businessId: string, updates: Partial<Business>) => void;
  onActivityLogged?: (newActivity: Activity) => void;
  size?: 'xs' | 'sm' | 'md';
}

export const CommunicationQuickActions: React.FC<CommunicationQuickActionsProps> = ({
  business,
  currentUser,
  mobile,
  email,
  contactPerson,
  companyName,
  leadStatus,
  onLogActivity,
  onBusinessUpdated,
  onActivityLogged,
  size = 'sm'
}) => {
  // Dropdowns state
  const [isWaDropdownOpen, setIsWaDropdownOpen] = useState(false);
  const [isEmailDropdownOpen, setIsEmailDropdownOpen] = useState(false);
  
  // WhatsApp Preview Modal
  const [isWaPreviewOpen, setIsWaPreviewOpen] = useState(false);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState<'cold' | 'followup'>('cold');
  const [waPreviewText, setWaPreviewText] = useState('');

  // Email Action & Preview Modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<'cold' | 'followup'>('cold');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSmtpConfigOpen, setIsSmtpConfigOpen] = useState(false);

  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(() => emailService.getSmtpConfig(currentUser?.uid));
  const [copiedType, setCopiedType] = useState<string>('');
  const [loggingStatus, setLoggingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const waDropdownRef = useRef<HTMLDivElement>(null);
  const emailDropdownRef = useRef<HTMLDivElement>(null);

  // Derive active values
  const effectiveMobile = business?.mobile || mobile || '';
  const effectiveEmail = business?.email || email || '';
  const effectiveContactPerson = business?.contactPerson || contactPerson || '';
  const effectiveCompanyName = business?.companyName || companyName || '';
  const effectiveStatus = business?.status || leadStatus || 'NEW';

  // Sender information from logged-in user or KRGONE defaults
  const senderInfo: EmailSenderInfo = {
    name: smtpConfig?.fromName || currentUser?.name || DEFAULT_SENDER.name,
    email: smtpConfig?.fromEmail || currentUser?.email || DEFAULT_SENDER.email,
    phone: smtpConfig?.phone || (currentUser as any)?.phone || DEFAULT_SENDER.phone
  };

  const assignedWaType = getAssignedWhatsAppTemplate(effectiveStatus);
  const assignedEmailType = getAssignedEmailTemplate(effectiveStatus);

  useEffect(() => {
    setSelectedWaTemplate(getAssignedWhatsAppTemplate(effectiveStatus));
    const eType = getAssignedEmailTemplate(effectiveStatus);
    setSelectedEmailTemplate(eType);
    setEmailSubject(buildEmailSubject(eType, effectiveCompanyName));
    setEmailBody(buildEmailBody(eType, effectiveContactPerson, effectiveCompanyName, senderInfo));
  }, [effectiveStatus, effectiveCompanyName, effectiveContactPerson, currentUser, smtpConfig]);

  // Sync SMTP config on load
  useEffect(() => {
    setSmtpConfig(emailService.getSmtpConfig(currentUser?.uid));
  }, [currentUser?.uid]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (waDropdownRef.current && !waDropdownRef.current.contains(event.target as Node)) {
        setIsWaDropdownOpen(false);
      }
      if (emailDropdownRef.current && !emailDropdownRef.current.contains(event.target as Node)) {
        setIsEmailDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse phone numbers
  const phoneList = parsePhoneNumbers(effectiveMobile);
  const primaryPhone = phoneList.length > 0 ? phoneList[0].cleaned : '';
  const cleanMobileForCall = effectiveMobile ? effectiveMobile.replace(/[^0-9+]/g, '') : '';

  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const padding = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(label);
    setTimeout(() => setCopiedType(''), 2500);
  };

  const openWaPreview = (templateType: 'cold' | 'followup') => {
    setSelectedWaTemplate(templateType);
    setWaPreviewText(buildWhatsAppMessage(templateType, effectiveContactPerson, effectiveCompanyName));
    setIsWaPreviewOpen(true);
    setIsWaDropdownOpen(false);
  };

  const openEmailModal = (templateType: 'cold' | 'followup' = assignedEmailType) => {
    setSelectedEmailTemplate(templateType);
    setEmailSubject(buildEmailSubject(templateType, effectiveCompanyName));
    setEmailBody(buildEmailBody(templateType, effectiveContactPerson, effectiveCompanyName, senderInfo));
    setEmailError(null);
    setIsEmailModalOpen(true);
    setIsEmailDropdownOpen(false);
  };

  /**
   * 1-Click WhatsApp Execution
   */
  const handleExecuteWhatsApp = async (
    templateType: 'cold' | 'followup',
    targetPhone: string,
    customText?: string
  ) => {
    if (!targetPhone) return;

    const message = customText || buildWhatsAppMessage(templateType, effectiveContactPerson, effectiveCompanyName);
    const waUrl = buildWhatsAppUrl(targetPhone, message);

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setIsWaDropdownOpen(false);
    setIsWaPreviewOpen(false);

    await recordPipelineAction({
      channel: 'WhatsApp',
      templateType,
      notes: `Sent ${templateType === 'cold' ? 'Cold Outreach (First Message)' : 'Follow-up Message'} via WhatsApp to ${cleanContactName(effectiveContactPerson)} Ji.`,
      nextActionTitle: 'WhatsApp Follow-up Message'
    });
  };

  /**
   * Direct 1-Click Send via Hostinger SMTP Backend
   */
  const handleDirectSmtpSend = async () => {
    if (!effectiveEmail) return;

    // Check if password exists
    const currentConfig = emailService.getSmtpConfig(currentUser?.uid);
    if (!currentConfig.pass || !currentConfig.pass.trim()) {
      setIsSmtpConfigOpen(true);
      setEmailError('Please enter and save your Hostinger mailbox password below to enable 1-click sending.');
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);

    const subject = emailSubject || buildEmailSubject(selectedEmailTemplate, effectiveCompanyName);
    const body = emailBody || buildEmailBody(selectedEmailTemplate, effectiveContactPerson, effectiveCompanyName, senderInfo);
    const htmlBody = buildEmailHtml(selectedEmailTemplate, effectiveContactPerson, effectiveCompanyName, senderInfo);

    try {
      await emailService.sendEmail({
        to: effectiveEmail,
        subject,
        text: body,
        html: htmlBody,
        smtpConfig: currentConfig
      });

      setIsEmailModalOpen(false);
      setIsEmailDropdownOpen(false);

      await recordPipelineAction({
        channel: 'Email',
        templateType: selectedEmailTemplate,
        notes: `Sent ${selectedEmailTemplate === 'cold' ? 'Cold Introduction Email' : 'Follow-up Email'} (Hostinger SMTP) from ${currentConfig.fromName} <${currentConfig.fromEmail}> to ${cleanContactName(effectiveContactPerson)} Ji <${effectiveEmail}>.\nSubject: "${subject}"`,
        nextActionTitle: 'Email Follow-up Message'
      });

      setToastMessage(`✅ Email delivered to ${effectiveEmail} via Hostinger SMTP!`);
    } catch (err: any) {
      console.error('Direct SMTP send failed:', err);
      setEmailError(err.message || 'Failed to dispatch email via Hostinger SMTP. Please check password.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  /**
   * Fallback Email Execution (Hostinger Webmail, Gmail Web, Mailto)
   */
  const handleExecuteEmailFallback = async (
    templateType: 'cold' | 'followup',
    targetEmail: string,
    mode: 'hostinger' | 'gmail' | 'mailto' = 'hostinger',
    customSubject?: string,
    customBody?: string
  ) => {
    if (!targetEmail) return;

    const subject = customSubject || emailSubject || buildEmailSubject(templateType, effectiveCompanyName);
    const body = customBody || emailBody || buildEmailBody(templateType, effectiveContactPerson, effectiveCompanyName, senderInfo);

    if (mode === 'hostinger') {
      navigator.clipboard.writeText(`To: ${targetEmail}\nSubject: ${subject}\n\n${body}`);
      window.open(getHostingerWebmailUrl(), '_blank', 'noopener,noreferrer');
      setToastMessage(`✅ Copied to clipboard & opened Hostinger Webmail! Follow-up set.`);
    } else if (mode === 'gmail') {
      const gmailUrl = buildGmailComposeUrl(targetEmail, subject, body);
      window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    } else {
      const mailtoUrl = buildMailtoUrl(targetEmail, subject, body);
      const a = document.createElement('a');
      a.href = mailtoUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    setIsEmailDropdownOpen(false);
    setIsEmailModalOpen(false);

    await recordPipelineAction({
      channel: 'Email',
      templateType,
      notes: `Sent ${templateType === 'cold' ? 'Cold Introduction Email' : 'Follow-up Email'} (${mode.toUpperCase()}) to ${cleanContactName(effectiveContactPerson)} Ji <${targetEmail}>.\nSubject: "${subject}"`,
      nextActionTitle: 'Email Follow-up Message'
    });
  };

  /**
   * Common Pipeline Recorder for WhatsApp & Email
   */
  const recordPipelineAction = async (params: {
    channel: 'WhatsApp' | 'Email';
    templateType: 'cold' | 'followup';
    notes: string;
    nextActionTitle: string;
  }) => {
    const bizId = business?.id;
    const orgId = business?.organizationId || currentUser?.organizationId || 'org_default';
    const followUpDate = calculateNextFollowUpDate(5);
    const rawStatus = (effectiveStatus || 'NEW').toUpperCase();

    setLoggingStatus('saving');

    try {
      // 1. Add Activity
      const newAct = await activityService.addActivity({
        organizationId: orgId,
        businessId: bizId || '',
        businessName: effectiveCompanyName,
        userId: currentUser?.uid,
        userName: currentUser?.name || currentUser?.email || DEFAULT_SENDER.name,
        type: params.channel,
        channel: params.channel,
        notes: `${params.notes}\nSchedule: 5-Day follow-up set for ${followUpDate}.`,
        outcome: params.templateType === 'cold' ? 'Cold Outreach Sent' : 'Follow-up Sent',
        followUpDate: followUpDate,
        nextAction: params.nextActionTitle,
        activityDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });

      onActivityLogged?.(newAct);

      // 2. Update Business Status, Omnichannel tracking, and Next Follow-up
      if (bizId) {
        const existingChannels = business?.contactChannels || [];
        const updatedChannels = Array.from(new Set([...existingChannels, params.channel]));
        const nowIso = new Date().toISOString();

        const updates: Partial<Business> = {
          nextFollowUpDate: followUpDate,
          nextAction: params.nextActionTitle,
          contactChannels: updatedChannels,
          lastContactMode: params.channel,
          lastContactedAt: nowIso
        };

        if (params.channel === 'Email') {
          updates.emailSentCount = (business?.emailSentCount || 0) + 1;
        } else if (params.channel === 'WhatsApp') {
          updates.whatsappSentCount = (business?.whatsappSentCount || 0) + 1;
        }

        if (rawStatus === 'NEW' || rawStatus === 'NEW LEADS' || rawStatus === 'NEW_LEAD') {
          updates.status = 'CONTACTED';
        }

        await businessService.updateBusiness(bizId, updates);
        onBusinessUpdated?.(bizId, updates);
      }

      setLoggingStatus('saved');
      if (!toastMessage) {
        setToastMessage(`✅ ${params.channel} logged! Follow-up set for ${followUpDate}`);
      }
      setTimeout(() => {
        setLoggingStatus('idle');
        setToastMessage('');
      }, 4000);
    } catch (err) {
      console.warn('Auto-logging pipeline action failed:', err);
      setLoggingStatus('idle');
    }
  };

  return (
    <>
      <div className="relative inline-flex items-center space-x-1.5">
        {/* CALL */}
        {cleanMobileForCall ? (
          <a
            href={`tel:${cleanMobileForCall}`}
            title={`Call ${effectiveMobile}`}
            className={`inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 rounded-lg transition-colors ${padding}`}
          >
            <Phone className={iconSize} />
            <span>Call</span>
          </a>
        ) : (
          <span className={`inline-flex items-center space-x-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg opacity-50 cursor-not-allowed ${padding}`}>
            <Phone className={iconSize} />
            <span>Call</span>
          </span>
        )}

        {/* 1-CLICK WHATSAPP WITH TEMPLATE DROPDOWN */}
        {primaryPhone ? (
          <div className="relative inline-flex rounded-lg shadow-2xs" ref={waDropdownRef}>
            <button
              type="button"
              onClick={() => handleExecuteWhatsApp(assignedWaType, primaryPhone)}
              title={`1-Click WhatsApp (${assignedWaType === 'cold' ? 'Cold Outreach' : 'Follow-up'} Template) → Auto-logs to CRM & sets 5-day follow-up`}
              className={`inline-flex items-center space-x-1 bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-700 font-bold border border-green-300 rounded-l-lg transition-colors border-r-0 ${padding}`}
            >
              {loggingStatus === 'saving' ? (
                <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <MessageSquare className={iconSize} />
              )}
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsWaDropdownOpen(!isWaDropdownOpen);
                setIsEmailDropdownOpen(false);
              }}
              title="Select WhatsApp Template or Preview"
              className="inline-flex items-center justify-center bg-green-50 hover:bg-green-100 text-green-700 font-bold border border-green-300 rounded-r-lg px-1 transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* WA Dropdown Popover */}
            {isWaDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-76 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2.5 space-y-2 text-xs text-left animate-in fade-in zoom-in-95 duration-100">
                <div className="px-1 py-1 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                      WhatsApp Engine
                    </span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    assignedWaType === 'cold' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    Auto: {assignedWaType.toUpperCase()}
                  </span>
                </div>

                {/* Cold WA */}
                <div className="p-2 rounded-lg hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>1. Cold Outreach</span>
                    </span>
                    {assignedWaType === 'cold' && (
                      <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200">
                        Assigned
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mb-2">
                    "Hi {cleanContactName(effectiveContactPerson)} Ji, Gajendra here from KRGONE..."
                  </p>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleExecuteWhatsApp('cold', primaryPhone)}
                      className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-[11px] transition-colors flex items-center justify-center space-x-1 shadow-2xs"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Send Cold</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openWaPreview('cold')}
                      title="Preview / Edit"
                      className="p-1 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Follow-up WA */}
                <div className="p-2 rounded-lg hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Repeat className="w-3.5 h-3.5 text-amber-600" />
                      <span>2. Follow-up</span>
                    </span>
                    {assignedWaType === 'followup' && (
                      <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                        Assigned
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mb-2">
                    "Hi {cleanContactName(effectiveContactPerson)} Ji, just following up on my earlier message..."
                  </p>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleExecuteWhatsApp('followup', primaryPhone)}
                      className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-[11px] transition-colors flex items-center justify-center space-x-1 shadow-2xs"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Send Follow-up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openWaPreview('followup')}
                      title="Preview / Edit"
                      className="p-1 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center space-x-1 text-slate-600 font-medium">
                    <Clock className="w-3 h-3 text-indigo-500" />
                    <span>Auto-schedules +5 days</span>
                  </span>
                  <span className="font-semibold text-green-700">Auto-logs CRM</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <span className={`inline-flex items-center space-x-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg opacity-50 cursor-not-allowed ${padding}`}>
            <MessageSquare className={iconSize} />
            <span>WhatsApp</span>
          </span>
        )}

        {/* 1-CLICK EMAIL WITH HOSTINGER SMTP DISPATCHER */}
        {effectiveEmail ? (
          <div className="relative inline-flex rounded-lg shadow-2xs" ref={emailDropdownRef}>
            {/* Primary Email Button opens the dedicated Action Modal */}
            <button
              type="button"
              onClick={() => openEmailModal(assignedEmailType)}
              title={`1-Click Email (${assignedEmailType === 'cold' ? 'Cold Outreach' : 'Follow-up'} Template) → Send via Hostinger SMTP`}
              className={`inline-flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 font-bold border border-blue-300 rounded-l-lg transition-colors border-r-0 ${padding}`}
            >
              <Mail className={iconSize} />
              <span>Email</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsEmailDropdownOpen(!isEmailDropdownOpen);
                setIsWaDropdownOpen(false);
              }}
              title="Select Email Options or Quick Launch Hostinger Webmail"
              className="inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-300 rounded-r-lg px-1 transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Email Dropdown Popover */}
            {isEmailDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-84 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2.5 space-y-2 text-xs text-left animate-in fade-in zoom-in-95 duration-100">
                <div className="px-1 py-1 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                      KRGONE Email Sequence
                    </span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    assignedEmailType === 'cold' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    Auto: {assignedEmailType.toUpperCase()}
                  </span>
                </div>

                {/* Option 1: Cold Email */}
                <div className="p-2 rounded-lg hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>1. Cold Outreach Email</span>
                    </span>
                    {assignedEmailType === 'cold' && (
                      <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200">
                        Assigned
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium truncate">
                    Subject: Exploring Business Growth Opportunities for {cleanCompanyName(effectiveCompanyName)}
                  </p>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => openEmailModal('cold')}
                      className="flex-1 text-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-2 rounded text-[10px] transition-colors flex items-center justify-center space-x-1 shadow-2xs"
                    >
                      <Send className="w-3 h-3" />
                      <span>1-Click Hostinger Send</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteEmailFallback('cold', effectiveEmail, 'hostinger')}
                      title="Open Hostinger Webmail"
                      className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold rounded text-[10px]"
                    >
                      Webmail
                    </button>
                  </div>
                </div>

                {/* Option 2: Follow-up Email */}
                <div className="p-2 rounded-lg hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Repeat className="w-3.5 h-3.5 text-amber-600" />
                      <span>2. Follow-up Email</span>
                    </span>
                    {assignedEmailType === 'followup' && (
                      <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                        Assigned
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium truncate">
                    Subject: Following up — KRGONE & {cleanCompanyName(effectiveCompanyName)}
                  </p>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => openEmailModal('followup')}
                      className="flex-1 text-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-2 rounded text-[10px] transition-colors flex items-center justify-center space-x-1 shadow-2xs"
                    >
                      <Send className="w-3 h-3" />
                      <span>1-Click Hostinger Send</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteEmailFallback('followup', effectiveEmail, 'hostinger')}
                      title="Open Hostinger Webmail"
                      className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold rounded text-[10px]"
                    >
                      Webmail
                    </button>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center space-x-1 text-slate-600 font-medium">
                    <Clock className="w-3 h-3 text-indigo-500" />
                    <span>Auto-schedules +5 days</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmailDropdownOpen(false);
                      setIsEmailModalOpen(true);
                      setIsSmtpConfigOpen(true);
                    }}
                    className="font-bold text-purple-700 hover:underline flex items-center space-x-0.5"
                  >
                    <SettingsIcon className="w-2.5 h-2.5" />
                    <span>Configure Mailbox</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <span className={`inline-flex items-center space-x-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg opacity-50 cursor-not-allowed ${padding}`}>
            <Mail className={iconSize} />
            <span>Email</span>
          </span>
        )}

        {/* QUICK LOG ACTIVITY BUTTON */}
        {onLogActivity && (
          <button
            onClick={onLogActivity}
            title="Log custom customer interaction"
            className={`inline-flex items-center space-x-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-2xs transition-colors ${padding}`}
          >
            <Plus className={iconSize} />
            <span>Activity</span>
          </button>
        )}

        {/* QUICK TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="absolute left-0 bottom-full mb-1.5 whitespace-nowrap z-50 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1 rounded-md shadow-lg border border-slate-700 flex items-center space-x-1 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* WHATSAPP MESSAGE PREVIEW MODAL */}
      {isWaPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">WhatsApp Message Preview</h3>
                  <p className="text-[11px] text-slate-500">
                    To: <span className="font-semibold text-slate-700">{cleanContactName(effectiveContactPerson)} Ji</span> ({effectiveCompanyName || 'Business'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWaPreviewOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="flex rounded-lg bg-slate-100 p-1 space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWaTemplate('cold');
                    setWaPreviewText(buildWhatsAppMessage('cold', effectiveContactPerson, effectiveCompanyName));
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-md font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 ${
                    selectedWaTemplate === 'cold' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cold Outreach</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWaTemplate('followup');
                    setWaPreviewText(buildWhatsAppMessage('followup', effectiveContactPerson, effectiveCompanyName));
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-md font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 ${
                    selectedWaTemplate === 'followup' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Follow-up</span>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">Message Body:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(waPreviewText, 'wa')}
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-600 hover:text-indigo-600"
                  >
                    {copiedType === 'wa' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'wa' ? 'Copied!' : 'Copy text'}</span>
                  </button>
                </div>
                <textarea
                  rows={10}
                  value={waPreviewText}
                  onChange={(e) => setWaPreviewText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 font-sans leading-relaxed"
                />
              </div>

              <div className="p-3 bg-green-50/80 border border-green-200 rounded-xl text-[11px] text-green-900 space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-green-700" />
                  <span>Automated Follow-Up (+5 Days)</span>
                </div>
                <p className="text-[10px] text-green-800">
                  Sending will move this lead to <strong>CONTACTED</strong> and schedule follow-up for <strong>{calculateNextFollowUpDate(5)}</strong>.
                </p>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsWaPreviewOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteWhatsApp(selectedWaTemplate, primaryPhone, waPreviewText)}
                className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm flex items-center space-x-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in WhatsApp & Log</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL EMAIL ACTION & 1-CLICK DISPATCH MODAL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150 text-left">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <span>KRGONE Automated Hostinger Email</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                      1-Click SMTP
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    To: <span className="font-semibold text-slate-700">{cleanContactName(effectiveContactPerson)} Ji</span> &lt;<span className="font-mono text-purple-700">{effectiveEmail}</span>&gt;
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setIsSmtpConfigOpen(!isSmtpConfigOpen)}
                  title="Configure Hostinger Mailbox"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors flex items-center space-x-1 text-xs font-semibold"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
              {/* Error Message */}
              {emailError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start space-x-2 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block">Delivery Error:</span>
                    <span>{emailError}</span>
                  </div>
                </div>
              )}

              {/* Inline Hostinger SMTP Settings Drawer */}
              {isSmtpConfigOpen && (
                <div className="mb-3 animate-in fade-in slide-in-from-top-2 duration-150">
                  <HostingerSmtpSettings
                    compact={true}
                    currentUser={currentUser}
                    onSaved={(cfg) => {
                      setSmtpConfig(cfg);
                      setIsSmtpConfigOpen(false);
                      setEmailError(null);
                    }}
                  />
                </div>
              )}

              {/* Sender Identity Banner */}
              <div className="p-2.5 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between text-[11px] text-purple-900">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <span>Sending as: </span>
                    <strong className="text-purple-950 font-bold">{senderInfo.name}</strong>
                    <span className="font-mono text-purple-700"> &lt;{senderInfo.email}&gt;</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSmtpConfigOpen(!isSmtpConfigOpen)}
                  className="text-[10px] font-bold text-purple-700 hover:underline"
                >
                  {isSmtpConfigOpen ? 'Hide Settings' : 'Edit Credentials'}
                </button>
              </div>

              {/* Template Tabs */}
              <div className="flex rounded-lg bg-slate-100 p-1 space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmailTemplate('cold');
                    setEmailSubject(buildEmailSubject('cold', effectiveCompanyName));
                    setEmailBody(buildEmailBody('cold', effectiveContactPerson, effectiveCompanyName, senderInfo));
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-md font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 ${
                    selectedEmailTemplate === 'cold' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>1. Cold Outreach Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmailTemplate('followup');
                    setEmailSubject(buildEmailSubject('followup', effectiveCompanyName));
                    setEmailBody(buildEmailBody('followup', effectiveContactPerson, effectiveCompanyName, senderInfo));
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-md font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 ${
                    selectedEmailTemplate === 'followup' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>2. Follow-up Email</span>
                </button>
              </div>

              {/* Subject Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">Subject Line:</label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(emailSubject, 'subject')}
                    className="text-[10px] font-bold text-purple-600 hover:underline flex items-center space-x-0.5"
                  >
                    {copiedType === 'subject' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedType === 'subject' ? 'Copied Subject' : 'Copy Subject'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Body Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-600">Email Body:</span>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(emailBody, 'body')}
                      className="text-[10px] font-bold text-purple-600 hover:underline flex items-center space-x-0.5"
                    >
                      {copiedType === 'body' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedType === 'body' ? 'Copied Body' : 'Copy Body'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`To: ${effectiveEmail}\nSubject: ${emailSubject}\n\n${emailBody}`, 'all')}
                      className="text-[10px] font-bold text-purple-700 hover:underline flex items-center space-x-0.5"
                    >
                      {copiedType === 'all' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedType === 'all' ? 'Copied All' : 'Copy All'}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={9}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-sans leading-relaxed"
                />
              </div>

              {/* Automation Pill */}
              <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-[11px] text-blue-900 space-y-0.5">
                <div className="font-bold flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-700" />
                  <span>Pipeline Automation (+5 Days)</span>
                </div>
                <p className="text-[10px] text-blue-800">
                  Sending will dispatch via Hostinger SMTP, advance this lead to <strong>CONTACTED</strong>, and schedule follow-up for <strong>{calculateNextFollowUpDate(5)}</strong>.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {/* Fallbacks */}
                <button
                  type="button"
                  onClick={() => handleExecuteEmailFallback(selectedEmailTemplate, effectiveEmail, 'hostinger', emailSubject, emailBody)}
                  title="Open in Hostinger Webmail portal"
                  className="px-2.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition flex items-center space-x-1"
                >
                  <Globe className="w-3.5 h-3.5 text-purple-600" />
                  <span>Webmail Tab</span>
                </button>

                {/* Primary: Direct 1-Click Send via Hostinger SMTP */}
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={handleDirectSmtpSend}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-lg shadow-sm transition flex items-center space-x-1.5"
                >
                  {isSendingEmail ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending via Hostinger...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>1-Click Send via Hostinger SMTP</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
