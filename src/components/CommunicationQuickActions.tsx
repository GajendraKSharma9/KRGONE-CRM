import React from 'react';
import { Phone, MessageSquare, Mail, Plus } from 'lucide-react';

interface CommunicationQuickActionsProps {
  mobile?: string;
  email?: string;
  contactPerson?: string;
  companyName?: string;
  onLogActivity?: () => void;
  size?: 'sm' | 'md';
}

export const CommunicationQuickActions: React.FC<CommunicationQuickActionsProps> = ({
  mobile,
  email,
  contactPerson,
  companyName,
  onLogActivity,
  size = 'sm'
}) => {
  const cleanMobile = mobile ? mobile.replace(/[^0-9+]/g, '') : '';
  const prefilledText = encodeURIComponent(
    `Hi ${contactPerson || 'there'}, this is regarding ${companyName || 'your business'}. I wanted to follow up with you. Please let me know a convenient time to connect.`
  );
  const waUrl = cleanMobile ? `https://wa.me/${cleanMobile.replace(/^\+/, '')}?text=${prefilledText}` : '#';

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const padding = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs';

  return (
    <div className="flex items-center space-x-1.5">
      {/* CALL */}
      {mobile ? (
        <a
          href={`tel:${cleanMobile}`}
          title={`Call ${mobile}`}
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

      {/* WHATSAPP */}
      {mobile ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`WhatsApp ${mobile}`}
          className={`inline-flex items-center space-x-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold border border-green-300 rounded-lg transition-colors ${padding}`}
        >
          <MessageSquare className={iconSize} />
          <span>WhatsApp</span>
        </a>
      ) : (
        <span className={`inline-flex items-center space-x-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg opacity-50 cursor-not-allowed ${padding}`}>
          <MessageSquare className={iconSize} />
          <span>WhatsApp</span>
        </span>
      )}

      {/* EMAIL */}
      {email ? (
        <a
          href={`mailto:${email}`}
          title={`Email ${email}`}
          className={`inline-flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 rounded-lg transition-colors ${padding}`}
        >
          <Mail className={iconSize} />
          <span>Email</span>
        </a>
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
          title="Log customer interaction activity"
          className={`inline-flex items-center space-x-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-2xs transition-colors ${padding}`}
        >
          <Plus className={iconSize} />
          <span>Activity</span>
        </button>
      )}
    </div>
  );
};
