import React, { useState, useEffect } from 'react';
import { ActivityType, Business, UserProfile, BusinessStatus } from '../types';
import { activityService } from '../services/activityService';
import { businessService } from '../services/businessService';
import { authService } from '../services/authService';
import { Modal } from './Modal';
import { Phone, MessageSquare, Mail, Users, FileText, Check, UserCheck } from 'lucide-react';

interface QuickActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business;
  user: UserProfile;
  onActivitySaved?: () => void;
}

const OUTCOME_OPTIONS = [
  'INTERESTED',
  'QUALIFIED',
  'DEMO SCHEDULED',
  'QUOTATION REQUESTED',
  'NOT REACHABLE',
  'FOLLOW-UP REQUIRED',
  'NOT INTERESTED'
];

export const QuickActivityModal: React.FC<QuickActivityModalProps> = ({
  isOpen,
  onClose,
  business,
  user,
  onActivitySaved
}) => {
  const [channel, setChannel] = useState<ActivityType>('Call');
  const [selectedOutcome, setSelectedOutcome] = useState('INTERESTED');
  const [customOutcome, setCustomOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState(business.nextFollowUpDate || '');
  const [nextAction, setNextAction] = useState(business.nextAction || '');
  const [leadStatus, setLeadStatus] = useState<BusinessStatus>(business.status || 'CONTACTED');
  const [assignedSalesperson, setAssignedSalesperson] = useState(business.assignedSalesperson || '');
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTeam() {
      if (user.organizationId) {
        try {
          const members = await authService.getTeamMembers(user.organizationId);
          setTeamMembers(members);
        } catch {
          // fallback
        }
      }
    }
    loadTeam();
  }, [user.organizationId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.organizationId || !business.id) return;

    const finalOutcome = customOutcome.trim() || selectedOutcome;

    try {
      setSaving(true);
      setError('');

      await activityService.addActivity({
        organizationId: user.organizationId,
        businessId: business.id,
        businessName: business.companyName,
        userId: user.uid,
        userName: user.name || user.email,
        type: channel,
        channel: channel,
        notes: notes.trim(),
        outcome: finalOutcome,
        followUpDate: followUpDate || undefined,
        nextAction: nextAction.trim() || undefined,
        activityDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });

      // Update lead status and assigned salesperson if changed or handed off
      const updates: Partial<Business> = {};
      if (leadStatus && leadStatus !== business.status) {
        updates.status = leadStatus;
      }
      if (assignedSalesperson !== business.assignedSalesperson) {
        updates.assignedSalesperson = assignedSalesperson;
      }
      if (Object.keys(updates).length > 0) {
        await businessService.updateBusiness(business.id, updates);
      }

      if (onActivitySaved) {
        onActivitySaved();
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to log activity:', err);
      setError(err.message || 'Failed to save activity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Interaction — ${business.companyName}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg">
            {error}
          </div>
        )}

        {/* CHANNEL SELECTION */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Interaction Channel
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[
              { type: 'Call' as ActivityType, label: 'CALL', icon: Phone },
              { type: 'WhatsApp' as ActivityType, label: 'WHATSAPP', icon: MessageSquare },
              { type: 'Email' as ActivityType, label: 'EMAIL', icon: Mail },
              { type: 'Meeting' as ActivityType, label: 'MEETING', icon: Users },
              { type: 'Note' as ActivityType, label: 'NOTE', icon: FileText }
            ].map(item => {
              const Icon = item.icon;
              const isSelected = channel === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setChannel(item.type)}
                  className={`p-2 rounded-xl font-bold flex flex-col items-center justify-center space-y-1 border transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* QUICK OUTCOME BUTTONS */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Quick Outcome
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {OUTCOME_OPTIONS.map(outcome => {
              const isSelected = selectedOutcome === outcome && !customOutcome;
              return (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => {
                    setSelectedOutcome(outcome);
                    setCustomOutcome('');
                    if (outcome === 'QUALIFIED' || outcome === 'DEMO SCHEDULED') {
                      setLeadStatus('QUALIFIED');
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {outcome}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            placeholder="Or type custom outcome..."
            value={customOutcome}
            onChange={e => setCustomOutcome(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
          />
        </div>

        {/* QUALIFICATION & HANDOFF SECTION */}
        <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs uppercase tracking-wider">
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span>Lead Qualification & Salesperson Handoff</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Update Lead Stage</label>
              <select
                value={leadStatus}
                onChange={(e) => setLeadStatus(e.target.value as BusinessStatus)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="NEW">NEW</option>
                <option value="CONTACTED">CONTACTED</option>
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="PROPOSAL">PROPOSAL</option>
                <option value="WON">WON</option>
                <option value="LOST">LOST</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Handoff to Salesperson</label>
              <select
                value={assignedSalesperson}
                onChange={(e) => setAssignedSalesperson(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="">-- Select Salesperson --</option>
                {teamMembers
                  .filter(m => m.role === 'Salesperson' || m.role === 'Manager')
                  .map(m => (
                    <option key={m.uid} value={m.name || m.email}>
                      {m.name} ({m.role})
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
        </div>

        {/* REMARKS */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
            Short Remark / Discussion Notes
          </label>
          <textarea
            rows={2}
            required
            placeholder="Enter key discussion details, customer response, quote details..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
          />
        </div>

        {/* NEXT FOLLOW-UP & ACTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Next Follow-up Date
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={e => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Next Action Plan
            </label>
            <input
              type="text"
              placeholder="e.g. Send proposal, call demo, email quote..."
              value={nextAction}
              onChange={e => setNextAction(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 flex items-center space-x-1"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'SAVE ACTIVITY'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
