import React, { useState } from 'react';
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Check, 
  Clock, 
  ChevronRight, 
  Calendar,
  Sparkles,
  Info,
  ExternalLink
} from 'lucide-react';
import { Business, Activity } from '../types';

export interface OmnichannelTouchBarProps {
  business: Business;
  activities?: Activity[];
  onOpenEmail?: () => void;
  onOpenWhatsApp?: () => void;
  onOpenCall?: () => void;
  onViewTimeline?: () => void;
  compact?: boolean;
}

export function formatTimeAgo(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return dateString || '';
  }
}

export function getLeadOutreachSummary(business: Business, activities?: Activity[]) {
  const bizId = business.id;
  const bizActivities = activities && bizId
    ? activities.filter(a => a.businessId === bizId || (a as any).companyName === business.companyName)
    : [];

  const emailActs = bizActivities.filter(a => a.type === 'Email' || a.channel === 'Email');
  const waActs = bizActivities.filter(a => a.type === 'WhatsApp' || a.channel === 'WhatsApp');
  const callActs = bizActivities.filter(a => a.type === 'Call' || a.channel === 'Call');

  const emailSent = emailActs.length > 0 || (business.emailSentCount || 0) > 0 || business.contactChannels?.includes('Email');
  const waSent = waActs.length > 0 || (business.whatsappSentCount || 0) > 0 || business.contactChannels?.includes('WhatsApp');
  const callLogged = callActs.length > 0 || (business.callLoggedCount || 0) > 0 || business.contactChannels?.includes('Call');

  const emailCount = Math.max(emailActs.length, business.emailSentCount || 0);
  const waCount = Math.max(waActs.length, business.whatsappSentCount || 0);
  const callCount = Math.max(callActs.length, business.callLoggedCount || 0);

  const lastEmailDate = emailActs[0]?.activityDate || emailActs[0]?.createdAt;
  const lastWaDate = waActs[0]?.activityDate || waActs[0]?.createdAt;
  const lastCallDate = callActs[0]?.activityDate || callActs[0]?.createdAt;

  const totalChannelsCount = (emailSent ? 1 : 0) + (waSent ? 1 : 0) + (callLogged ? 1 : 0);

  let badgeLabel = 'Untouched';
  let badgeColor = 'bg-slate-100 text-slate-500 border-slate-200';

  if (totalChannelsCount >= 3) {
    badgeLabel = '⚡ 3-Channel Touch';
    badgeColor = 'bg-purple-100 text-purple-800 border-purple-300 font-extrabold';
  } else if (totalChannelsCount === 2) {
    if (emailSent && waSent) {
      badgeLabel = '🔥 Email + WhatsApp';
    } else if (emailSent && callLogged) {
      badgeLabel = '🔥 Email + Call';
    } else {
      badgeLabel = '🔥 WhatsApp + Call';
    }
    badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200 font-bold';
  } else if (totalChannelsCount === 1) {
    if (emailSent) {
      badgeLabel = '✉️ Emailed';
      badgeColor = 'bg-blue-100 text-blue-800 border-blue-200 font-bold';
    } else if (waSent) {
      badgeLabel = '💬 WhatsApped';
      badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
    } else {
      badgeLabel = '📞 Called';
      badgeColor = 'bg-amber-100 text-amber-800 border-amber-200 font-bold';
    }
  }

  return {
    emailSent,
    waSent,
    callLogged,
    emailCount,
    waCount,
    callCount,
    lastEmailDate,
    lastWaDate,
    lastCallDate,
    totalChannelsCount,
    badgeLabel,
    badgeColor,
    bizActivities
  };
}

export const OmnichannelTouchBar: React.FC<OmnichannelTouchBarProps> = ({
  business,
  activities = [],
  onOpenEmail,
  onOpenWhatsApp,
  onOpenCall,
  onViewTimeline,
  compact = false
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const summary = getLeadOutreachSummary(business, activities);

  return (
    <div className="relative inline-flex items-center space-x-1.5 py-0.5">
      {/* 1. EMAIL TOUCH PILL */}
      {summary.emailSent ? (
        <button
          type="button"
          onClick={onOpenEmail}
          title={`Emailed (${summary.emailCount} sent)${summary.lastEmailDate ? ` • Last: ${formatTimeAgo(summary.lastEmailDate)}` : ''}`}
          className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-[10.5px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 transition-all shadow-2xs group cursor-pointer"
        >
          <Mail className="w-3 h-3 text-blue-600" />
          <span>Email</span>
          <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-extrabold ml-0.5">
            ✓
          </span>
          {summary.lastEmailDate && (
            <span className="text-[9px] text-blue-500 font-medium hidden sm:inline-block">
              {formatTimeAgo(summary.lastEmailDate)}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenEmail}
          title="Send email outreach to this contact"
          className="inline-flex items-center space-x-1 px-1.5 py-1 rounded-md text-[10.5px] font-semibold bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-200 transition-all cursor-pointer"
        >
          <Mail className="w-3 h-3" />
          <span>+ Mail</span>
        </button>
      )}

      {/* 2. WHATSAPP TOUCH PILL */}
      {summary.waSent ? (
        <button
          type="button"
          onClick={onOpenWhatsApp}
          title={`WhatsApp message sent${summary.lastWaDate ? ` • Last: ${formatTimeAgo(summary.lastWaDate)}` : ''}`}
          className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-[10.5px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all shadow-2xs group cursor-pointer"
        >
          <MessageSquare className="w-3 h-3 text-emerald-600" />
          <span>WhatsApp</span>
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-extrabold ml-0.5">
            ✓
          </span>
          {summary.lastWaDate && (
            <span className="text-[9px] text-emerald-600 font-medium hidden sm:inline-block">
              {formatTimeAgo(summary.lastWaDate)}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenWhatsApp}
          title="Send WhatsApp template to this contact"
          className="inline-flex items-center space-x-1 px-1.5 py-1 rounded-md text-[10.5px] font-semibold bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition-all cursor-pointer"
        >
          <MessageSquare className="w-3 h-3" />
          <span>+ WA</span>
        </button>
      )}

      {/* 3. CALL TOUCH PILL */}
      {summary.callLogged ? (
        <button
          type="button"
          onClick={onOpenCall}
          title={`Call Logged (${summary.callCount})${summary.lastCallDate ? ` • Last: ${formatTimeAgo(summary.lastCallDate)}` : ''}`}
          className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-[10.5px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-all shadow-2xs group cursor-pointer"
        >
          <Phone className="w-3 h-3 text-amber-600" />
          <span>Call</span>
          <span className="w-3.5 h-3.5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px] font-extrabold ml-0.5">
            ✓
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenCall}
          title="Call or log a phone conversation"
          className="inline-flex items-center space-x-1 px-1.5 py-1 rounded-md text-[10.5px] font-semibold bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-800 border border-slate-200 hover:border-amber-200 transition-all cursor-pointer"
        >
          <Phone className="w-3 h-3" />
          <span>+ Call</span>
        </button>
      )}

      {/* 4. OVERALL SUMMARY STATUS BADGE */}
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] border ${summary.badgeColor}`}>
        {summary.badgeLabel}
      </span>
    </div>
  );
};
