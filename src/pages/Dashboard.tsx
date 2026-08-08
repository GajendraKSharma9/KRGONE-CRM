import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Activity as ActivityIcon, 
  Plus, 
  ArrowUpRight, 
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  CloudUpload,
  RefreshCw,
  Calendar,
  Flame,
  UserCheck,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { UserProfile, Business, Activity, ActivityType } from '../types';
import { businessService } from '../services/businessService';
import { activityService } from '../services/activityService';
import { Modal } from '../components/Modal';
import { CommunicationQuickActions } from '../components/CommunicationQuickActions';
import { QuickActivityModal } from '../components/QuickActivityModal';

interface DashboardProps {
  user: UserProfile;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Role View state
  const [roleView, setRoleView] = useState<'Manager' | 'Telecaller' | 'Salesperson'>('Manager');
  
  // Follow-up tab state
  const [followUpTab, setFollowUpTab] = useState<'today' | 'overdue' | 'upcoming' | 'my'>('today');

  // Quick activity modal on dashboard
  const [selectedBizForActivity, setSelectedBizForActivity] = useState<Business | null>(null);
  const [activityForm, setActivityForm] = useState({
    channel: 'Call' as ActivityType,
    outcome: 'Interested',
    notes: '',
    followUpDate: '',
    nextAction: ''
  });
  const [savingActivity, setSavingActivity] = useState(false);

  const loadDashboardData = async () => {
    if (!user.organizationId) return;
    try {
      setLoading(true);
      setError('');
      const [bizData, actData, unCount] = await Promise.all([
        businessService.getBusinesses(user.organizationId),
        activityService.getActivities(user.organizationId),
        businessService.getUnsyncedCount(user.organizationId)
      ]);

      setBusinesses(bizData);
      setActivities(actData);
      setUnsyncedCount(unCount);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to connect to database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user.organizationId]);

  const handleSyncToCloud = async () => {
    if (!user.organizationId) return;
    try {
      setSyncing(true);
      setSyncMessage('');
      const result = await businessService.syncUnsyncedToFirestore(user.organizationId);
      if (result.syncedCount > 0) {
        setSyncMessage(`Successfully saved ${result.syncedCount} record(s) to Cloud Firestore!`);
        setTimeout(() => setSyncMessage(''), 5000);
      } else {
        setSyncMessage('All business records are now synced to Cloud Firestore.');
        setTimeout(() => setSyncMessage(''), 3000);
      }
      await loadDashboardData();
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncMessage(`Sync failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Quick Activity Submit
  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizForActivity || !user.organizationId) return;
    try {
      setSavingActivity(true);
      await activityService.addActivity({
        organizationId: user.organizationId,
        businessId: selectedBizForActivity.id || '',
        businessName: selectedBizForActivity.companyName,
        userId: user.uid,
        userName: user.name,
        type: activityForm.channel,
        channel: activityForm.channel,
        notes: activityForm.notes,
        outcome: activityForm.outcome,
        followUpDate: activityForm.followUpDate,
        nextAction: activityForm.nextAction,
        activityDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
      setSelectedBizForActivity(null);
      setActivityForm({
        channel: 'Call',
        outcome: 'Interested',
        notes: '',
        followUpDate: '',
        nextAction: ''
      });
      await loadDashboardData();
    } catch (err: any) {
      console.error('Failed to log activity:', err);
    } finally {
      setSavingActivity(false);
    }
  };

  // Date Calculations for Follow-ups (Local Calendar Date YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const todayFollowUps = useMemo(() => {
    return businesses.filter(b => 
      b.nextFollowUpDate === todayStr && 
      b.status !== 'WON' && b.status !== 'Won' && 
      b.status !== 'LOST' && b.status !== 'Lost'
    );
  }, [businesses, todayStr]);

  const overdueFollowUps = useMemo(() => {
    return businesses.filter(b => 
      b.nextFollowUpDate && b.nextFollowUpDate < todayStr && 
      b.status !== 'WON' && b.status !== 'Won' && 
      b.status !== 'LOST' && b.status !== 'Lost'
    );
  }, [businesses, todayStr]);

  const upcomingFollowUps = useMemo(() => {
    return businesses.filter(b => 
      b.nextFollowUpDate && b.nextFollowUpDate > todayStr && 
      b.status !== 'WON' && b.status !== 'Won' && 
      b.status !== 'LOST' && b.status !== 'Lost'
    );
  }, [businesses, todayStr]);

  const myFollowUps = useMemo(() => {
    const uName = (user.name || user.email || '').toLowerCase();
    return businesses.filter(b => {
      if (!b.nextFollowUpDate) return false;
      if (b.status === 'WON' || b.status === 'Won' || b.status === 'LOST' || b.status === 'Lost') return false;
      const tele = (b.assignedTelecaller || b.assignedTelecallerName || '').toLowerCase();
      const sales = (b.assignedSalesperson || b.assignedSalespersonName || '').toLowerCase();
      return (tele && tele.includes(uName)) || (sales && sales.includes(uName)) || (!tele && !sales);
    });
  }, [businesses, user]);

  // Status Metrics
  const totalBusinesses = businesses.length;
  const newLeads = businesses.filter(b => b.status === 'NEW' || b.status === 'New').length;
  const contactedLeads = businesses.filter(b => b.status === 'CONTACTED').length;
  const qualifiedLeads = businesses.filter(b => b.status === 'QUALIFIED').length;
  const wonDeals = businesses.filter(b => b.status === 'WON' || b.status === 'Won').length;
  const lostDeals = businesses.filter(b => b.status === 'LOST' || b.status === 'Lost').length;

  const hotLeads = businesses.filter(b => b.leadTemperature === 'HOT').length;
  const warmLeads = businesses.filter(b => b.leadTemperature === 'WARM').length;
  const coldLeads = businesses.filter(b => b.leadTemperature === 'COLD').length;

  const unassignedLeads = useMemo(() => {
    return businesses.filter(b => 
      !b.assignedTelecaller && !b.assignedTelecallerName &&
      !b.assignedSalesperson && !b.assignedSalespersonName
    ).length;
  }, [businesses]);

  const totalActivities = activities.length;
  const recentBusinesses = businesses.slice(0, 5);
  const recentActivities = activities.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <h3 className="font-semibold text-lg mb-1">Firestore Connection Warning</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-extrabold tracking-tight">KRGONE Sales Navigator™</h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
              CRM Workspace
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Welcome back, <strong className="text-white">{user.name}</strong>. Business → Lead → Activity → Follow-Up Pipeline.
          </p>
        </div>

        {/* Role View Switcher */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setRoleView('Manager')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              roleView === 'Manager'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Manager
          </button>
          <button
            onClick={() => setRoleView('Telecaller')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              roleView === 'Telecaller'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📞 Telecaller
          </button>
          <button
            onClick={() => setRoleView('Salesperson')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              roleView === 'Salesperson'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🎯 Salesperson
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold rounded-lg transition-colors shadow-sm cursor-pointer border border-amber-500 disabled:opacity-50"
            title="Sync all records with Cloud Firestore database"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${syncing ? 'animate-bounce' : ''}`} />
            <span>{syncing ? 'Syncing...' : unsyncedCount > 0 ? `Sync ${unsyncedCount}` : 'Cloud Sync'}</span>
          </button>
          <Link
            to="/businesses"
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Business</span>
          </Link>
          <Link
            to="/bulk-import"
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Import</span>
          </Link>
        </div>
      </div>

      {/* Cloud Sync Status Notification */}
      <div className="p-3.5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-xl shadow-xs border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg flex-shrink-0 border border-amber-500/30">
            <CloudUpload className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Cloud Firestore Database Status: Active
              </h4>
              <span className="px-2 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                Online
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {unsyncedCount > 0 
                ? `⚠️ ${unsyncedCount} record(s) stored locally. Click Sync Now to upload.`
                : `✓ ${totalBusinesses} business lead records actively synchronized with Firestore.`}
            </p>
          </div>
        </div>
        <button
          onClick={handleSyncToCloud}
          disabled={syncing}
          className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shadow-2xs transition-transform active:scale-98 disabled:opacity-50 flex-shrink-0 flex items-center justify-center space-x-1.5 cursor-pointer border border-amber-500"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Uploading...' : '⚡ Sync Now'}</span>
        </button>
      </div>

      {syncMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* ROLE-BASED KPI SUMMARY DASHBOARD */}
      {roleView === 'Manager' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Directory</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalBusinesses}</p>
            <span className="text-[10px] text-slate-400">Master Records</span>
          </div>

          <Link to="/businesses?unassigned=true" className="bg-white p-4 rounded-xl border border-orange-200 bg-orange-50/30 shadow-2xs hover:shadow-md transition-all group">
            <span className="text-[11px] font-bold text-orange-700 uppercase flex items-center space-x-1">
              <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
              <span>Unassigned</span>
            </span>
            <p className="text-2xl font-extrabold text-orange-600 mt-1 group-hover:scale-105 transition-transform">{unassignedLeads}</p>
            <span className="text-[10px] text-orange-700/80 underline font-semibold">Assign Now →</span>
          </Link>

          <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
            <span className="text-[11px] font-bold text-blue-600 uppercase">New Leads</span>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">{newLeads}</p>
            <span className="text-[10px] text-slate-400">Fresh Prospects</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase flex items-center space-x-1">
              <span>🔔 Today's Follow-ups</span>
            </span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{todayFollowUps.length}</p>
            <span className="text-[10px] text-amber-700/80">Action Due Today</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-rose-700 uppercase flex items-center space-x-1">
              <span>⚠️ Overdue Follow-ups</span>
            </span>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{overdueFollowUps.length}</p>
            <span className="text-[10px] text-rose-700/80">Pending Action</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
            <span className="text-[11px] font-bold text-indigo-600 uppercase flex items-center space-x-1">
              <span>📅 Upcoming</span>
            </span>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">{upcomingFollowUps.length}</p>
            <span className="text-[10px] text-indigo-700/70">Future Follow-ups</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Won Deals</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{wonDeals}</p>
            <span className="text-[10px] text-emerald-700/70">Conversions</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-2xs">
            <span className="text-[11px] font-bold text-purple-600 uppercase flex items-center space-x-1">
              <Flame className="w-3.5 h-3.5 text-purple-500 fill-purple-500" />
              <span>Hot Leads</span>
            </span>
            <p className="text-2xl font-extrabold text-purple-600 mt-1">{hotLeads}</p>
            <span className="text-[10px] text-purple-700/70">High Priority</span>
          </div>
        </div>
      )}

      {roleView === 'Telecaller' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-blue-700 uppercase">New Uncontacted</span>
            <p className="text-2xl font-extrabold text-blue-700 mt-1">{newLeads}</p>
            <span className="text-[10px] text-blue-600">Pending Initial Call</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-amber-800 uppercase flex items-center space-x-1">
              <span>🔔 Today's Follow-ups</span>
            </span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{todayFollowUps.length}</p>
            <span className="text-[10px] text-amber-700">Scheduled Today</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-rose-700 uppercase flex items-center space-x-1">
              <span>⚠️ Overdue Follow-ups</span>
            </span>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{overdueFollowUps.length}</p>
            <span className="text-[10px] text-rose-600">Missed Follow-ups</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-indigo-700 uppercase">📅 Upcoming</span>
            <p className="text-2xl font-extrabold text-indigo-700 mt-1">{upcomingFollowUps.length}</p>
            <span className="text-[10px] text-indigo-600">Future Pipeline</span>
          </div>
        </div>
      )}

      {roleView === 'Salesperson' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase flex items-center space-x-1">
              <span>🔔 Today's Follow-ups</span>
            </span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{todayFollowUps.length}</p>
            <span className="text-[10px] text-amber-700">Action Due Today</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-rose-700 uppercase flex items-center space-x-1">
              <span>⚠️ Overdue Follow-ups</span>
            </span>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{overdueFollowUps.length}</p>
            <span className="text-[10px] text-rose-600">Requires Follow-up</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-purple-700 uppercase">Qualified Leads</span>
            <p className="text-2xl font-extrabold text-purple-700 mt-1">{qualifiedLeads}</p>
            <span className="text-[10px] text-purple-600">Active Opportunities</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Won Deals</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{wonDeals}</p>
            <span className="text-[10px] text-emerald-600">Closed Sales</span>
          </div>
        </div>
      )}

      {/* FOLLOW-UP COMMAND CENTER WIDGET */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">CRM Follow-Up Command Center</h2>
          </div>

          {/* Follow-up Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl space-x-1 text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setFollowUpTab('today')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                followUpTab === 'today'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today ({todayFollowUps.length})
            </button>
            <button
              onClick={() => setFollowUpTab('overdue')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                followUpTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overdue ({overdueFollowUps.length})
            </button>
            <button
              onClick={() => setFollowUpTab('upcoming')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                followUpTab === 'upcoming'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upcoming ({upcomingFollowUps.length})
            </button>
            <button
              onClick={() => setFollowUpTab('my')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                followUpTab === 'my'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Follow-ups ({myFollowUps.length})
            </button>
          </div>
        </div>

        {/* Tab Content List */}
        {(() => {
          const list = followUpTab === 'today' 
            ? todayFollowUps 
            : followUpTab === 'overdue' 
            ? overdueFollowUps 
            : followUpTab === 'upcoming'
            ? upcomingFollowUps
            : myFollowUps;

          if (list.length === 0) {
            return (
              <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                ✓ No {followUpTab} follow-ups pending. Great job staying on top of customer interactions!
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Business / Company</th>
                    <th className="py-2.5 px-3">Contact Person</th>
                    <th className="py-2.5 px-3">Status / Temp</th>
                    <th className="py-2.5 px-3">Scheduled Action</th>
                    <th className="py-2.5 px-3">Follow-Up Date</th>
                    <th className="py-2.5 px-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map(biz => (
                    <tr key={biz.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{biz.companyName}</span>
                        <span className="text-[11px] text-slate-500">{biz.industry}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-800 block">{biz.contactPerson || 'N/A'}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{biz.mobile || biz.email}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            biz.status === 'WON' || biz.status === 'Won' ? 'bg-emerald-100 text-emerald-800' :
                            biz.status === 'QUALIFIED' ? 'bg-purple-100 text-purple-800' :
                            biz.status === 'CONTACTED' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {biz.status}
                          </span>
                          {biz.leadTemperature && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                              biz.leadTemperature === 'HOT' ? 'bg-amber-100 text-amber-800' :
                              biz.leadTemperature === 'WARM' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {biz.leadTemperature === 'HOT' ? '🔥 HOT' : biz.leadTemperature === 'WARM' ? '☀️ WARM' : '❄️ COLD'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <span className="text-slate-800 font-medium block truncate">
                          {biz.nextAction || 'Follow-up interaction'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-mono text-xs font-bold ${
                          followUpTab === 'overdue' ? 'text-rose-600' : followUpTab === 'today' ? 'text-amber-600' : 'text-slate-600'
                        }`}>
                          {biz.nextFollowUpDate}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end">
                          <CommunicationQuickActions
                            mobile={biz.mobile}
                            email={biz.email}
                            contactPerson={biz.contactPerson}
                            companyName={biz.companyName}
                            onLogActivity={() => setSelectedBizForActivity(biz)}
                            size="xs"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Businesses */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Recent Business Records</span>
            </h2>
            <Link to="/businesses" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center">
              <span>View Directory</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {recentBusinesses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No businesses recorded yet. Click "Add Business" or use Excel Import.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentBusinesses.map((biz) => (
                <div key={biz.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{biz.companyName}</p>
                    <p className="text-xs text-slate-500">{biz.contactPerson || 'No contact'} • {biz.industry}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        biz.status === 'WON' || biz.status === 'Won'
                          ? 'bg-emerald-50 text-emerald-700'
                          : biz.status === 'LOST' || biz.status === 'Lost'
                          ? 'bg-rose-50 text-rose-700'
                          : biz.status === 'QUALIFIED'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {biz.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ActivityIcon className="w-5 h-5 text-purple-600" />
              <span>Recent Activity Timeline</span>
            </h2>
            <Link to="/activities" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center">
              <span>View All Log</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No activities logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <div key={act.id} className="py-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">
                        {act.type || act.channel || 'Call'}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {act.businessName || 'General Activity'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{act.notes}</p>
                    {act.outcome && (
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                        Outcome: {act.outcome}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap ml-2">
                    {act.activityDate}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QUICK LOG ACTIVITY MODAL */}
      {selectedBizForActivity && (
        <QuickActivityModal
          isOpen={!!selectedBizForActivity}
          onClose={() => setSelectedBizForActivity(null)}
          business={selectedBizForActivity}
          user={user}
          onActivitySaved={loadDashboardData}
        />
      )}
    </div>
  );
};

