import React, { useEffect, useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  Phone, 
  Mail as MailIcon, 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Activity as ActivityIcon,
  Tag,
  CloudUpload,
  RefreshCw,
  LayoutGrid,
  List,
  Flame,
  UserCheck,
  CheckSquare,
  Square
} from 'lucide-react';
import { UserProfile, Business, BusinessStatus, Activity, ActivityType } from '../types';
import { businessService } from '../services/businessService';
import { activityService } from '../services/activityService';
import { authService } from '../services/authService';
import { calculateLeadHealth, exportBusinessesToCSV, calculateLeadVelocity } from '../services/intelligenceService';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { CommunicationQuickActions } from '../components/CommunicationQuickActions';
import { QuickActivityModal } from '../components/QuickActivityModal';
import { Download, ShieldAlert, HeartPulse, Hash } from 'lucide-react';

interface BusinessesProps {
  user: UserProfile;
}

const PIPELINE_STAGES: { key: BusinessStatus; label: string; headerColor: string; badgeColor: string }[] = [
  { key: 'NEW', label: 'NEW LEADS', headerColor: 'bg-blue-600 text-white', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'CONTACTED', label: 'CONTACTED', headerColor: 'bg-amber-600 text-white', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'QUALIFIED', label: 'QUALIFIED', headerColor: 'bg-purple-600 text-white', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'PROPOSAL', label: 'PROPOSAL', headerColor: 'bg-indigo-600 text-white', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'WON', label: 'WON', headerColor: 'bg-emerald-600 text-white', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'LOST', label: 'LOST', headerColor: 'bg-rose-600 text-white', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' }
];

export const Businesses: React.FC<BusinessesProps> = ({ user }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // View Mode State
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [industryFilter, setIndustryFilter] = useState<string>('All');
  const [temperatureFilter, setTemperatureFilter] = useState<string>('All');
  const [telecallerFilter, setTelecallerFilter] = useState<string>('All');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('All');
  const [healthFilter, setHealthFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [stuckFilter, setStuckFilter] = useState<boolean>(false);
  const [staleHotFilter, setStaleHotFilter] = useState<boolean>(false);
  const [followUpFilter, setFollowUpFilter] = useState<string>('All');
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [customTagInput, setCustomTagInput] = useState<string>('');

  // Bulk Selection & Assignment State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTelecaller, setBulkTelecaller] = useState('');
  const [bulkSalesperson, setBulkSalesperson] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Quick Activity Modal Target
  const [activityTargetBiz, setActivityTargetBiz] = useState<Business | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Selected Business for View/Edit/Delete
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [relatedActivities, setRelatedActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    industry: 'Technology',
    city: '',
    status: 'NEW' as BusinessStatus,
    temperature: 'WARM' as 'HOT' | 'WARM' | 'COLD',
    assignedTelecaller: '',
    assignedSalesperson: '',
    nextFollowUpDate: '',
    nextAction: '',
    tags: [] as string[],
    dealValue: '' as string | number,
    expectedClosureDate: ''
  });

  // Quick activity form state inside View Detail modal
  const [quickActivity, setQuickActivity] = useState({
    type: 'Call' as ActivityType,
    notes: '',
    activityDate: new Date().toISOString().split('T')[0]
  });
  const [addingActivity, setAddingActivity] = useState(false);

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);

  const handleSyncToCloud = async () => {
    if (!user.organizationId) return;
    try {
      setSyncing(true);
      setError('');
      const res = await businessService.syncUnsyncedToFirestore(user.organizationId);
      if (res.syncedCount > 0) {
        setSuccessMessage(`Successfully synced ${res.syncedCount} business contact(s) to Cloud Firestore!`);
        setTimeout(() => setSuccessMessage(''), 4000);
        await loadBusinesses();
      } else {
        setSuccessMessage('All business contacts are already saved in Cloud Firestore.');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Error syncing to cloud:', err);
      setError(err.message || 'Failed to sync contacts to Cloud Firestore.');
    } finally {
      setSyncing(false);
    }
  };

  // Load Businesses & Team Members
  const loadBusinesses = async () => {
    if (!user.organizationId) return;
    try {
      setLoading(true);
      setError('');
      const [data, unCount, team, acts] = await Promise.all([
        businessService.getBusinesses(user.organizationId),
        businessService.getUnsyncedCount(user.organizationId),
        authService.getTeamMembers(user.organizationId),
        activityService.getActivities(user.organizationId)
      ]);
      setBusinesses(data);
      setUnsyncedCount(unCount);
      setTeamMembers(team);
      setAllActivities(acts);
    } catch (err: any) {
      console.error('Error fetching businesses / team:', err);
      setError(err.message || 'Failed to load businesses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, [user.organizationId]);

  // Handle URL Query Params on mount (e.g., ?unassigned=true, ?health=AT_RISK, etc.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('unassigned') === 'true' || params.get('filter') === 'unassigned') {
      setTelecallerFilter('Unassigned');
      setSalespersonFilter('Unassigned');
    }
    if (params.get('telecaller')) setTelecallerFilter(params.get('telecaller')!);
    if (params.get('salesperson')) setSalespersonFilter(params.get('salesperson')!);
    if (params.get('health')) setHealthFilter(params.get('health')!);
    if (params.get('tag')) setTagFilter(params.get('tag')!);
    if (params.get('temp')) setTemperatureFilter(params.get('temp')!);
    if (params.get('status')) setStatusFilter(params.get('status')!);
    if (params.get('stuck') === 'true') setStuckFilter(true);
    if (params.get('staleHot') === 'true') setStaleHotFilter(true);
    if (params.get('filter') === 'overdue') setFollowUpFilter('Overdue');
    if (params.get('filter') === 'today') setFollowUpFilter('Today');
  }, []);

  // Extract unique industries for filter
  const industries = useMemo(() => {
    const set = new Set<string>();
    businesses.forEach(b => {
      if (b.industry) set.add(b.industry);
    });
    return Array.from(set);
  }, [businesses]);

  // Extract unique tags for filter
  const allTags = useMemo(() => {
    const set = new Set<string>();
    businesses.forEach(b => {
      if (b.tags && Array.isArray(b.tags)) {
        b.tags.forEach(t => set.add(t));
      }
    });
    return Array.from(set);
  }, [businesses]);

  // Stage Update Handler
  const handleUpdateStage = async (bizId: string, newStage: BusinessStatus) => {
    try {
      await businessService.updateBusiness(bizId, { status: newStage });
      setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, status: newStage } : b));
      setSuccessMessage(`Lead moved to ${newStage}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to update stage:', err);
      alert('Failed to update stage: ' + err.message);
    }
  };

  // Bulk Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredBusinesses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBusinesses.map(b => b.id).filter(Boolean) as string[]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0) return;
    if (!bulkTelecaller && !bulkSalesperson) {
      alert('Please select a Telecaller or Salesperson to assign.');
      return;
    }

    try {
      setBulkAssigning(true);
      setError('');
      const updates: Record<string, any> = {};
      if (bulkTelecaller) {
        updates.assignedTelecaller = bulkTelecaller === '__NONE__' ? '' : bulkTelecaller;
      }
      if (bulkSalesperson) {
        updates.assignedSalesperson = bulkSalesperson === '__NONE__' ? '' : bulkSalesperson;
      }

      await Promise.all(
        selectedIds.map(id => businessService.updateBusiness(id, updates))
      );

      setSuccessMessage(`Successfully updated assignment for ${selectedIds.length} lead(s)!`);
      setTimeout(() => setSuccessMessage(''), 4000);
      setSelectedIds([]);
      setBulkTelecaller('');
      setBulkSalesperson('');
      await loadBusinesses();
    } catch (err: any) {
      console.error('Failed bulk assignment:', err);
      setError('Failed bulk assignment: ' + err.message);
    } finally {
      setBulkAssigning(false);
    }
  };

  // Filtered Businesses
  const filteredBusinesses = useMemo(() => {
    return businesses.filter(b => {
      // Search
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        b.companyName.toLowerCase().includes(query) ||
        (b.contactPerson || '').toLowerCase().includes(query) ||
        (b.mobile || '').toLowerCase().includes(query) ||
        (b.email || '').toLowerCase().includes(query) ||
        (b.city || '').toLowerCase().includes(query);

      // Status Filter
      const bStatus = (b.status || 'NEW').toUpperCase();
      const matchesStatus = statusFilter === 'All' || bStatus === statusFilter.toUpperCase();

      // Industry Filter
      const matchesIndustry = industryFilter === 'All' || b.industry === industryFilter;

      // Temperature / My Leads Filter
      let matchesTemp = true;
      if (temperatureFilter === 'HOT') matchesTemp = b.temperature === 'HOT';
      else if (temperatureFilter === 'WARM') matchesTemp = b.temperature === 'WARM';
      else if (temperatureFilter === 'COLD') matchesTemp = b.temperature === 'COLD';
      else if (temperatureFilter === 'MY_LEADS') {
        const uName = (user.name || user.email || '').toLowerCase();
        const tele = (b.assignedTelecaller || b.assignedTelecallerName || '').toLowerCase();
        const sales = (b.assignedSalesperson || b.assignedSalespersonName || '').toLowerCase();
        matchesTemp = (tele && tele.includes(uName)) || (sales && sales.includes(uName)) || (!tele && !sales);
      }

      // Telecaller Filter
      let matchesTelecaller = true;
      if (telecallerFilter === 'Unassigned') {
        matchesTelecaller = !b.assignedTelecaller && !b.assignedTelecallerName;
      } else if (telecallerFilter !== 'All') {
        const tName = (b.assignedTelecaller || b.assignedTelecallerName || '').toLowerCase();
        matchesTelecaller = tName.includes(telecallerFilter.toLowerCase());
      }

      // Salesperson Filter
      let matchesSalesperson = true;
      if (salespersonFilter === 'Unassigned') {
        matchesSalesperson = !b.assignedSalesperson && !b.assignedSalespersonName;
      } else if (salespersonFilter !== 'All') {
        const sName = (b.assignedSalesperson || b.assignedSalespersonName || '').toLowerCase();
        matchesSalesperson = sName.includes(salespersonFilter.toLowerCase());
      }

      // Health Filter
      let matchesHealth = true;
      if (healthFilter !== 'All') {
        const health = calculateLeadHealth(b, allActivities);
        matchesHealth = health === healthFilter;
      }

      // Tag Filter
      let matchesTag = true;
      if (tagFilter !== 'All') {
        matchesTag = Array.isArray(b.tags) && b.tags.includes(tagFilter);
      }

      // Stuck Filter (>14 days in same stage without conversion)
      let matchesStuck = true;
      if (stuckFilter) {
        const velocity = calculateLeadVelocity(b, allActivities);
        matchesStuck = velocity.daysInCurrentStage >= 14 && b.status !== 'WON' && b.status !== 'Won' && b.status !== 'LOST' && b.status !== 'Lost';
      }

      // Stale Hot Filter (HOT lead with no activity for >3 days)
      let matchesStaleHot = true;
      if (staleHotFilter) {
        const isHot = (b.temperature || b.leadTemperature) === 'HOT';
        const health = calculateLeadHealth(b, allActivities);
        matchesStaleHot = isHot && health === 'AT RISK';
      }

      // Follow-up Filter
      let matchesFollowUp = true;
      const todayStr = new Date().toISOString().split('T')[0];
      if (followUpFilter === 'Overdue') {
        matchesFollowUp = !!(b.nextFollowUpDate && b.nextFollowUpDate < todayStr && b.status !== 'WON' && b.status !== 'Won' && b.status !== 'LOST' && b.status !== 'Lost');
      } else if (followUpFilter === 'Today') {
        matchesFollowUp = b.nextFollowUpDate === todayStr && b.status !== 'WON' && b.status !== 'Won' && b.status !== 'LOST' && b.status !== 'Lost';
      }

      return matchesSearch && matchesStatus && matchesIndustry && matchesTemp && matchesTelecaller && matchesSalesperson && matchesHealth && matchesTag && matchesStuck && matchesStaleHot && matchesFollowUp;
    });
  }, [businesses, searchQuery, statusFilter, industryFilter, temperatureFilter, telecallerFilter, salespersonFilter, healthFilter, tagFilter, stuckFilter, staleHotFilter, followUpFilter, allActivities, user]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData({
      companyName: '',
      contactPerson: '',
      mobile: '',
      email: '',
      industry: 'Technology',
      city: '',
      status: 'NEW' as BusinessStatus,
      temperature: 'WARM',
      assignedTelecaller: user.role === 'Telecaller' ? (user.name || user.email) : '',
      assignedSalesperson: user.role === 'Salesperson' ? (user.name || user.email) : '',
      nextFollowUpDate: new Date().toISOString().split('T')[0],
      nextAction: 'Initial contact call',
      tags: [],
      dealValue: '',
      expectedClosureDate: ''
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (biz: Business) => {
    setSelectedBusiness(biz);
    setFormData({
      companyName: biz.companyName,
      contactPerson: biz.contactPerson || '',
      mobile: biz.mobile || '',
      email: biz.email || '',
      industry: biz.industry || 'General',
      city: biz.city || '',
      status: biz.status || 'NEW',
      temperature: biz.temperature || 'WARM',
      assignedTelecaller: biz.assignedTelecaller || '',
      assignedSalesperson: biz.assignedSalesperson || '',
      nextFollowUpDate: biz.nextFollowUpDate || '',
      nextAction: biz.nextAction || '',
      tags: biz.tags || [],
      dealValue: biz.dealValue !== undefined && biz.dealValue !== null ? biz.dealValue : '',
      expectedClosureDate: biz.expectedClosureDate || ''
    });
    setIsEditModalOpen(true);
  };

  // Open View Detail Modal
  const handleOpenView = async (biz: Business) => {
    setSelectedBusiness(biz);
    setIsViewModalOpen(true);
    if (biz.id) {
      try {
        setLoadingActivities(true);
        const acts = await activityService.getActivitiesByBusiness(biz.id);
        setRelatedActivities(acts);
      } catch (err) {
        console.error('Error fetching business activities:', err);
      } finally {
        setLoadingActivities(false);
      }
    }
  };

  // Open Delete Confirm Modal
  const handleOpenDelete = (biz: Business) => {
    setSelectedBusiness(biz);
    setIsDeleteModalOpen(true);
  };

  // Save New Business
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) return;

    try {
      setSaving(true);
      const newBiz = await businessService.addBusiness({
        organizationId: user.organizationId,
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        mobile: formData.mobile,
        email: formData.email,
        industry: formData.industry,
        city: formData.city,
        status: formData.status,
        temperature: formData.temperature,
        assignedTelecaller: formData.assignedTelecaller,
        assignedSalesperson: formData.assignedSalesperson,
        nextFollowUpDate: formData.nextFollowUpDate,
        nextAction: formData.nextAction,
        tags: formData.tags,
        dealValue: formData.dealValue !== '' ? Number(formData.dealValue) : undefined,
        expectedClosureDate: formData.expectedClosureDate || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setBusinesses(prev => [newBiz, ...prev]);
      setIsAddModalOpen(false);
      showSuccess('Business created successfully!');
    } catch (err: any) {
      console.error('Error adding business:', err);
      alert('Failed to add business: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Save Edit Business
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness?.id || !formData.companyName.trim()) return;

    try {
      setSaving(true);
      await businessService.updateBusiness(selectedBusiness.id, {
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        mobile: formData.mobile,
        email: formData.email,
        industry: formData.industry,
        city: formData.city,
        status: formData.status,
        temperature: formData.temperature,
        assignedTelecaller: formData.assignedTelecaller,
        assignedSalesperson: formData.assignedSalesperson,
        nextFollowUpDate: formData.nextFollowUpDate,
        nextAction: formData.nextAction,
        tags: formData.tags,
        dealValue: formData.dealValue !== '' ? Number(formData.dealValue) : null,
        expectedClosureDate: formData.expectedClosureDate || null
      });

      setBusinesses(prev => prev.map(b => b.id === selectedBusiness.id ? {
        ...b,
        ...formData,
        dealValue: formData.dealValue !== '' ? Number(formData.dealValue) : undefined,
        expectedClosureDate: formData.expectedClosureDate || undefined,
        updatedAt: new Date().toISOString()
      } : b));

      setIsEditModalOpen(false);
      showSuccess('Business updated successfully!');
    } catch (err: any) {
      console.error('Error updating business:', err);
      alert('Failed to update business: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete Business
  const handleDeleteConfirm = async () => {
    if (!selectedBusiness?.id) return;

    try {
      setSaving(true);
      await businessService.deleteBusiness(selectedBusiness.id);
      setBusinesses(prev => prev.filter(b => b.id !== selectedBusiness.id));
      setIsDeleteModalOpen(false);
      showSuccess('Business deleted successfully.');
    } catch (err: any) {
      console.error('Error deleting business:', err);
      alert('Failed to delete business: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Quick Add Activity inside Business Detail view
  const handleQuickActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness?.id || !quickActivity.notes.trim()) return;

    try {
      setAddingActivity(true);
      const newAct = await activityService.addActivity({
        organizationId: user.organizationId,
        businessId: selectedBusiness.id,
        businessName: selectedBusiness.companyName,
        type: quickActivity.type,
        notes: quickActivity.notes,
        activityDate: quickActivity.activityDate,
        createdAt: new Date().toISOString()
      });

      setRelatedActivities(prev => [newAct, ...prev]);
      setQuickActivity({
        type: 'Call',
        notes: '',
        activityDate: new Date().toISOString().split('T')[0]
      });
      showSuccess('Activity logged!');
    } catch (err: any) {
      console.error('Error adding activity:', err);
      alert('Failed to log activity: ' + err.message);
    } finally {
      setAddingActivity(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Businesses Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage your client accounts, leads, and organizational records.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer border border-amber-500 disabled:opacity-50"
            title="Sync records to Cloud Firestore database (default)"
          >
            <CloudUpload className={`w-4 h-4 text-amber-950 ${syncing ? 'animate-bounce' : ''}`} />
            <span>
              {syncing 
                ? 'Syncing to Cloud...' 
                : unsyncedCount > 0 
                  ? `⚡ Sync ${unsyncedCount} Unsynced Records` 
                  : '⚡ Sync to Cloud Firestore'}
            </span>
          </button>
          <button
            onClick={() => loadBusinesses()}
            className="inline-flex items-center justify-center p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-colors"
            title="Refresh from Cloud Firestore"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => exportBusinessesToCSV(filteredBusinesses, allActivities)}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
            title="Export filtered leads to Excel/CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Business</span>
          </button>
        </div>
      </div>

      {/* Always-Visible Universal Cloud Sync Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl shadow-md border border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl flex-shrink-0">
            <CloudUpload className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Cloud Firestore Database Sync Engine
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                Target: (default)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {unsyncedCount > 0 ? (
                <span className="text-amber-300 font-semibold">
                  ⚠️ {unsyncedCount} contact(s) waiting in local cache. Click <strong>Sync Now</strong> to upload directly to Cloud Firestore.
                </span>
              ) : (
                <span className="text-slate-300">
                  ✓ All {businesses.length} contact records are verified and synced with your Cloud Firestore database.
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 self-end md:self-auto">
          <button
            onClick={() => loadBusinesses()}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center space-x-1.5"
            title="Refresh from Cloud Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 border border-amber-500 disabled:opacity-50 cursor-pointer"
          >
            <CloudUpload className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
            <span>{syncing ? 'Syncing...' : '⚡ Sync to Cloud Now'}</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl animate-in fade-in">
          {successMessage}
        </div>
      )}

      {/* Search, Filters and View Toggle Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:space-x-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, contact, mobile, email, city..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Telecaller Filter */}
          <select
            value={telecallerFilter}
            onChange={(e) => setTelecallerFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Telecallers</option>
            <option value="Unassigned">⚠️ Unassigned Telecaller</option>
            {teamMembers
              .filter(m => m.role === 'Telecaller' || m.role === 'Manager')
              .map(m => (
                <option key={m.uid} value={m.name || m.email}>
                  📞 {m.name || m.email}
                </option>
              ))
            }
          </select>

          {/* Salesperson Filter */}
          <select
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Salespeople</option>
            <option value="Unassigned">⚠️ Unassigned Salesperson</option>
            {teamMembers
              .filter(m => m.role === 'Salesperson' || m.role === 'Manager')
              .map(m => (
                <option key={m.uid} value={m.name || m.email}>
                  💼 {m.name || m.email}
                </option>
              ))
            }
          </select>

          {/* Temperature / Priority Filter */}
          <select
            value={temperatureFilter}
            onChange={(e) => setTemperatureFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Lead Temp</option>
            <option value="HOT">🔥 HOT Leads</option>
            <option value="WARM">☀️ WARM Leads</option>
            <option value="COLD">❄️ COLD Leads</option>
            <option value="MY_LEADS">👤 My Assigned Leads</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Statuses</option>
            <option value="NEW">NEW</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="PROPOSAL">PROPOSAL</option>
            <option value="WON">WON</option>
            <option value="LOST">LOST</option>
          </select>

          {/* Lead Health Filter */}
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Lead Health</option>
            <option value="HEALTHY">🟢 HEALTHY</option>
            <option value="NEEDS ATTENTION">🟡 NEEDS ATTENTION</option>
            <option value="AT RISK">🔴 AT RISK</option>
          </select>

          {/* Tag Filter */}
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>🏷️ {tag}</option>
            ))}
          </select>

          {/* Follow-Up Filter */}
          <select
            value={followUpFilter}
            onChange={(e) => setFollowUpFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Follow-ups</option>
            <option value="Today">📅 Due Today</option>
            <option value="Overdue">🚨 Overdue</option>
          </select>

          {/* Industry Filter */}
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Industries</option>
            {industries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>

          {/* Quick Segment buttons */}
          <button
            onClick={() => setStuckFilter(!stuckFilter)}
            className={`px-2.5 py-2 text-xs font-bold rounded-lg border transition-all flex items-center space-x-1 ${
              stuckFilter
                ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Leads stuck in the current stage for 14+ days"
          >
            <span>⏳ Stuck Leads</span>
          </button>

          <button
            onClick={() => setStaleHotFilter(!staleHotFilter)}
            className={`px-2.5 py-2 text-xs font-bold rounded-lg border transition-all flex items-center space-x-1 ${
              staleHotFilter
                ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="HOT leads with no recent activity (3+ days)"
          >
            <span>⚠️ Stale Hot</span>
          </button>

          {/* VIEW SWITCHER TOGGLE */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1 ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kanban Visual Lead Pipeline"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="List Directory Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* BULK LEAD ASSIGNMENT ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <span className="bg-blue-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-md">
              {selectedIds.length} Selected
            </span>
            <span className="text-xs text-slate-300 font-bold">Bulk Assign Lead Ownership:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkTelecaller}
              onChange={(e) => setBulkTelecaller(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Assign Telecaller --</option>
              <option value="__NONE__">(Unassign Telecaller)</option>
              {teamMembers
                .filter(m => m.role === 'Telecaller' || m.role === 'Manager')
                .map(m => (
                  <option key={m.uid} value={m.name || m.email}>
                    📞 {m.name || m.email} ({m.role})
                  </option>
                ))
              }
            </select>

            <select
              value={bulkSalesperson}
              onChange={(e) => setBulkSalesperson(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Assign Salesperson --</option>
              <option value="__NONE__">(Unassign Salesperson)</option>
              {teamMembers
                .filter(m => m.role === 'Salesperson' || m.role === 'Manager')
                .map(m => (
                  <option key={m.uid} value={m.name || m.email}>
                    💼 {m.name || m.email} ({m.role})
                  </option>
                ))
              }
            </select>

            <button
              type="button"
              onClick={handleBulkAssign}
              disabled={bulkAssigning}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{bulkAssigning ? 'Assigning...' : 'ASSIGN SELECTED'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-16 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-400 font-medium">Loading sales pipeline records...</p>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">No businesses found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {searchQuery || statusFilter !== 'All' || industryFilter !== 'All' || temperatureFilter !== 'All'
              ? 'No businesses match your current search and filter criteria.'
              : 'No businesses yet. Start by creating a new lead or importing contacts.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Business Lead</span>
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN VISUAL LEAD PIPELINE VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map(stage => {
            const stageLeads = filteredBusinesses.filter(
              b => (b.status || 'NEW').toUpperCase() === stage.key
            );

            return (
              <div
                key={stage.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const bizId = e.dataTransfer.getData('text/plain');
                  if (bizId) handleUpdateStage(bizId, stage.key);
                }}
                className="bg-slate-100/70 rounded-xl p-2.5 border border-slate-200/80 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className={`p-2 rounded-lg ${stage.headerColor} flex items-center justify-between mb-3 shadow-2xs`}>
                  <span className="font-black text-[11px] tracking-wider uppercase">{stage.label}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {stageLeads.length === 0 ? (
                    <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-xl text-[11px] text-slate-400 font-medium">
                      Drop lead here
                    </div>
                  ) : (
                    stageLeads.map(biz => (
                      <div
                        key={biz.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', biz.id || '')}
                        className={`p-3 rounded-xl border shadow-2xs hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing group ${
                          biz.id && selectedIds.includes(biz.id)
                            ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        {/* Header: Select Checkbox + Company Name + Temp */}
                        <div className="flex items-start justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (biz.id) toggleSelectOne(biz.id);
                            }}
                            className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                            title={biz.id && selectedIds.includes(biz.id) ? 'Deselect lead' : 'Select lead for bulk assignment'}
                          >
                            {biz.id && selectedIds.includes(biz.id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 fill-blue-50" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <h4
                              onClick={() => handleOpenView(biz)}
                              className="font-bold text-xs text-slate-900 hover:text-blue-600 transition-colors cursor-pointer truncate"
                              title={biz.companyName}
                            >
                              {biz.companyName}
                            </h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {biz.contactPerson || 'No contact'}
                            </p>
                          </div>

                          {biz.temperature && (
                            <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-md border shrink-0 ${
                              biz.temperature === 'HOT'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : biz.temperature === 'WARM'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {biz.temperature === 'HOT' ? '🔥 HOT' : biz.temperature === 'WARM' ? '☀️ WARM' : '❄️ COLD'}
                            </span>
                          )}
                        </div>

                        {/* Assigned + Follow up details */}
                        <div className="text-[10px] space-y-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          {(biz.assignedTelecaller || biz.assignedSalesperson) && (
                            <p className="text-slate-600 font-medium truncate">
                              👤 {biz.assignedTelecaller || biz.assignedSalesperson}
                            </p>
                          )}
                          {biz.nextFollowUpDate && (
                            <p className="text-slate-700 font-semibold flex items-center">
                              <Clock className="w-3 h-3 mr-1 text-slate-400" />
                              {biz.nextFollowUpDate}
                            </p>
                          )}
                          {biz.nextAction && (
                            <p className="text-blue-700 font-medium truncate">
                              🎯 {biz.nextAction}
                            </p>
                          )}
                          {/* Lead Health and Velocity */}
                          {biz.dealValue !== undefined && biz.dealValue !== null && biz.dealValue !== 0 && (
                            <div className="text-[10px] text-emerald-700 font-extrabold flex items-center justify-between bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                              <span className="flex items-center">
                                <span className="mr-0.5">₹</span>
                                {biz.dealValue.toLocaleString('en-IN')}
                              </span>
                              {biz.expectedClosureDate && (
                                <span className="text-slate-500 font-medium text-[8px]">
                                  Exp: {biz.expectedClosureDate}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[9px] text-slate-500 font-semibold">
                            <span className="flex items-center">
                              {(() => {
                                const h = calculateLeadHealth(biz, allActivities);
                                return h === 'HEALTHY' ? (
                                  <span className="text-emerald-600 flex items-center"><HeartPulse className="w-3 h-3 mr-0.5" /> Healthy</span>
                                ) : h === 'NEEDS ATTENTION' ? (
                                  <span className="text-amber-600 flex items-center"><HeartPulse className="w-3 h-3 mr-0.5" /> Attention</span>
                                ) : (
                                  <span className="text-rose-600 flex items-center"><ShieldAlert className="w-3 h-3 mr-0.5" /> At Risk</span>
                                );
                              })()}
                            </span>
                            <span>
                              {(() => {
                                const vel = calculateLeadVelocity(biz, allActivities);
                                return `Age: ${vel.totalAgeDays}d • Stage: ${vel.daysInCurrentStage}d`;
                              })()}
                            </span>
                          </div>
                          {/* Tags list */}
                          {biz.tags && biz.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {biz.tags.map(tag => (
                                <span key={tag} className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded text-[8px] font-bold">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Communication Quick Actions */}
                        <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                          <CommunicationQuickActions
                            mobile={biz.mobile}
                            email={biz.email}
                            contactPerson={biz.contactPerson}
                            companyName={biz.companyName}
                            onLogActivity={() => setActivityTargetBiz(biz)}
                            size="sm"
                          />
                        </div>

                        {/* Footer Controls */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                          <select
                            value={stage.key}
                            onChange={(e) => biz.id && handleUpdateStage(biz.id, e.target.value as BusinessStatus)}
                            className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-700 focus:outline-none"
                          >
                            {PIPELINE_STAGES.map(s => (
                              <option key={s.key} value={s.key}>Move: {s.label}</option>
                            ))}
                          </select>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleOpenEdit(biz)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded"
                              title="Edit"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleOpenDelete(biz)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DIRECTORY TABLE VIEW */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3.5 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                      title={selectedIds.length === filteredBusinesses.length && filteredBusinesses.length > 0 ? 'Deselect all' : 'Select all'}
                    >
                      {selectedIds.length === filteredBusinesses.length && filteredBusinesses.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 fill-blue-50" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5">Company / City</th>
                  <th className="px-4 py-3.5">Contact Person</th>
                  <th className="px-4 py-3.5">Status & Temp</th>
                  <th className="px-4 py-3.5">Health & Age</th>
                  <th className="px-4 py-3.5">Quick Actions</th>
                  <th className="px-4 py-3.5">Assigned To</th>
                  <th className="px-4 py-3.5">Next Follow-Up</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredBusinesses.map((biz) => (
                  <tr 
                    key={biz.id} 
                    className={`transition-colors ${
                      biz.id && selectedIds.includes(biz.id) ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-3 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => biz.id && toggleSelectOne(biz.id)}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        {biz.id && selectedIds.includes(biz.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 fill-blue-50" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">{biz.companyName}</p>
                      <p className="text-[11px] text-slate-500 flex items-center mt-0.5">
                        {biz.city ? `${biz.city} • ` : ''}{biz.industry || 'General'}
                      </p>
                      {biz.dealValue !== undefined && biz.dealValue !== null && biz.dealValue !== 0 && (
                        <div className="mt-1 flex items-center text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded w-fit border border-emerald-100">
                          <span>₹{biz.dealValue.toLocaleString('en-IN')}</span>
                          {biz.expectedClosureDate && (
                            <span className="text-slate-400 font-normal ml-2">Exp: {biz.expectedClosureDate}</span>
                          )}
                        </div>
                      )}
                      {/* Tags list inside Company column */}
                      {biz.tags && biz.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {biz.tags.map(tag => (
                            <span key={tag} className="px-1 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-bold">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-800 font-medium">{biz.contactPerson || '-'}</p>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">{biz.mobile || biz.email || '-'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-1.5">
                        <select
                           value={(biz.status || 'NEW').toUpperCase()}
                          onChange={(e) => biz.id && handleUpdateStage(biz.id, e.target.value as BusinessStatus)}
                          className="px-2 py-0.5 text-[10px] font-extrabold rounded-md border bg-white focus:outline-none"
                        >
                          {PIPELINE_STAGES.map(s => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                        {biz.temperature && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              biz.temperature === 'HOT'
                                ? 'bg-rose-100 text-rose-800'
                                : biz.temperature === 'WARM'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {biz.temperature === 'HOT' ? '🔥 HOT' : biz.temperature === 'WARM' ? '☀️ WARM' : '❄️ COLD'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {(() => {
                        const h = calculateLeadHealth(biz, allActivities);
                        const vel = calculateLeadVelocity(biz, allActivities);
                        return (
                          <div className="space-y-1">
                            <div>
                              {h === 'HEALTHY' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  🟢 HEALTHY
                                </span>
                              ) : h === 'NEEDS ATTENTION' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                  🟡 ATTENTION
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                  🔴 AT RISK
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-semibold">
                              Age: {vel.totalAgeDays}d • Stage: {vel.daysInCurrentStage}d
                            </p>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3.5">
                      <CommunicationQuickActions
                        mobile={biz.mobile}
                        email={biz.email}
                        contactPerson={biz.contactPerson}
                        companyName={biz.companyName}
                        onLogActivity={() => setActivityTargetBiz(biz)}
                        size="sm"
                      />
                    </td>
                    <td className="px-5 py-3.5 text-[11px]">
                      {biz.assignedTelecaller || biz.assignedSalesperson ? (
                        <div>
                          {biz.assignedTelecaller && (
                            <p className="text-slate-700 font-medium">📞 {biz.assignedTelecaller}</p>
                          )}
                          {biz.assignedSalesperson && (
                            <p className="text-slate-700 font-medium">💼 {biz.assignedSalesperson}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {biz.nextFollowUpDate ? (
                        <div>
                          <p className="font-mono text-[11px] font-bold text-slate-800 flex items-center">
                            <Clock className="w-3 h-3 mr-1 text-slate-400" />
                            {biz.nextFollowUpDate}
                          </p>
                          {biz.nextAction && (
                            <p className="text-[10px] text-slate-500 truncate max-w-[120px]" title={biz.nextAction}>
                              {biz.nextAction}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenView(biz)}
                          title="View Detail"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(biz)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(biz)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD BUSINESS MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Business">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Acme Corporation"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+1 555-0192"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@acme.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="Technology, Finance, Healthcare..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="New York, Mumbai..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as BusinessStatus })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="NEW">NEW</option>
                <option value="CONTACTED">CONTACTED</option>
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="WON">WON</option>
                <option value="LOST">LOST</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Temperature</label>
              <select
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value as 'HOT' | 'WARM' | 'COLD' })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="HOT">🔥 HOT</option>
                <option value="WARM">☀️ WARM</option>
                <option value="COLD">❄️ COLD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Telecaller</label>
              <select
                value={formData.assignedTelecaller}
                onChange={(e) => setFormData({ ...formData, assignedTelecaller: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="">-- Unassigned --</option>
                {teamMembers
                  .filter(m => m.role === 'Telecaller' || m.role === 'Manager')
                  .map(m => (
                    <option key={m.uid} value={m.name || m.email}>
                      📞 {m.name || m.email} ({m.role})
                    </option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Salesperson</label>
              <select
                value={formData.assignedSalesperson}
                onChange={(e) => setFormData({ ...formData, assignedSalesperson: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="">-- Unassigned --</option>
                {teamMembers
                  .filter(m => m.role === 'Salesperson' || m.role === 'Manager')
                  .map(m => (
                    <option key={m.uid} value={m.name || m.email}>
                      💼 {m.name || m.email} ({m.role})
                    </option>
                  ))
                }
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-Up Date</label>
              <input
                type="date"
                value={formData.nextFollowUpDate}
                onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Action</label>
              <input
                type="text"
                value={formData.nextAction}
                onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
                placeholder="e.g. Call demo, send quote, follow up..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100/60 space-y-3">
            <h4 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Deal & Pipeline Accountability</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deal Value (INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={formData.dealValue}
                    onChange={(e) => setFormData({ ...formData, dealValue: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full pl-6 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Closure Date</label>
                <input
                  type="date"
                  value={formData.expectedClosureDate}
                  onChange={(e) => setFormData({ ...formData, expectedClosureDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={(formData.tags || []).join(', ')}
              onChange={(e) => {
                const tagsArr = e.target.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
                setFormData({ ...formData, tags: tagsArr });
              }}
              placeholder="qualified, priority-1, trial-user"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
            >
              {saving ? 'Saving...' : 'Save Business'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT BUSINESS MODAL */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Business">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="City"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as BusinessStatus })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="NEW">NEW</option>
                <option value="CONTACTED">CONTACTED</option>
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="WON">WON</option>
                <option value="LOST">LOST</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Temperature</label>
              <select
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value as 'HOT' | 'WARM' | 'COLD' })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="HOT">🔥 HOT</option>
                <option value="WARM">☀️ WARM</option>
                <option value="COLD">❄️ COLD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Telecaller</label>
              <select
                value={formData.assignedTelecaller}
                onChange={(e) => setFormData({ ...formData, assignedTelecaller: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="">-- Unassigned --</option>
                {teamMembers
                  .filter(m => m.role === 'Telecaller' || m.role === 'Manager')
                  .map(m => (
                    <option key={m.uid} value={m.name || m.email}>
                      📞 {m.name || m.email} ({m.role})
                    </option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Salesperson</label>
              <select
                value={formData.assignedSalesperson}
                onChange={(e) => setFormData({ ...formData, assignedSalesperson: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="">-- Unassigned --</option>
                {teamMembers
                  .filter(m => m.role === 'Salesperson' || m.role === 'Manager')
                  .map(m => (
                    <option key={m.uid} value={m.name || m.email}>
                      💼 {m.name || m.email} ({m.role})
                    </option>
                  ))
                }
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-Up Date</label>
              <input
                type="date"
                value={formData.nextFollowUpDate}
                onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Action</label>
              <input
                type="text"
                value={formData.nextAction}
                onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
                placeholder="e.g. Call demo, send quote..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100/60 space-y-3">
            <h4 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Deal & Pipeline Accountability</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deal Value (INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={formData.dealValue}
                    onChange={(e) => setFormData({ ...formData, dealValue: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full pl-6 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Closure Date</label>
                <input
                  type="date"
                  value={formData.expectedClosureDate}
                  onChange={(e) => setFormData({ ...formData, expectedClosureDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={(formData.tags || []).join(', ')}
              onChange={(e) => {
                const tagsArr = e.target.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
                setFormData({ ...formData, tags: tagsArr });
              }}
              placeholder="qualified, priority-1, trial-user"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
            >
              {saving ? 'Saving...' : 'Update Business'}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW BUSINESS DETAIL MODAL */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title={selectedBusiness?.companyName || 'Business Detail'}
        maxWidth="max-w-2xl"
      >
        {selectedBusiness && (
          <div className="space-y-6">
            {/* Overview Header */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-800 text-sm">{selectedBusiness.companyName}</span>
                <CommunicationQuickActions
                  mobile={selectedBusiness.mobile}
                  email={selectedBusiness.email}
                  contactPerson={selectedBusiness.contactPerson}
                  companyName={selectedBusiness.companyName}
                  onLogActivity={() => setActivityTargetBiz(selectedBusiness)}
                  size="sm"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-slate-400 block font-semibold">Contact Person</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5">
                  <User className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.contactPerson || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Mobile</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5 font-mono">
                  <Phone className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.mobile || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Email</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5">
                  <MailIcon className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.email || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Industry</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5">
                  <Tag className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.industry || 'General'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Status</span>
                <span className="font-bold text-blue-600 mt-0.5 block">{selectedBusiness.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Created Date</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.createdAt ? new Date(selectedBusiness.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              </div>

              {/* Lead Intelligence Section inside Detail Box */}
              <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-slate-400 block font-semibold">Lead Health Status</span>
                  {(() => {
                    const h = calculateLeadHealth(selectedBusiness, allActivities);
                    return h === 'HEALTHY' ? (
                      <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        🟢 HEALTHY
                      </span>
                    ) : h === 'NEEDS ATTENTION' ? (
                      <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        🟡 NEEDS ATTENTION
                      </span>
                    ) : (
                      <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        🔴 AT RISK
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Lead Velocity / Age</span>
                  {(() => {
                    const vel = calculateLeadVelocity(selectedBusiness, allActivities);
                    return (
                      <span className="font-bold text-slate-800 block mt-1 space-y-0.5">
                        <span className="block">⏱️ Total Age: <strong>{vel.totalAgeDays}</strong> days</span>
                        <span className="block">🚪 In Stage: <strong>{vel.daysInCurrentStage}</strong> days</span>
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Associated Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedBusiness.tags && selectedBusiness.tags.length > 0 ? (
                      selectedBusiness.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-[10px] border border-slate-300">
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No tags assigned</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Add Activity Form */}
            <div className="border border-blue-100 bg-blue-50/40 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center">
                <ActivityIcon className="w-4 h-4 mr-1.5 text-blue-600" />
                Log New Sales Activity
              </h4>
              <form onSubmit={handleQuickActivitySubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Activity Type</label>
                    <select
                      value={quickActivity.type}
                      onChange={(e) => setQuickActivity({ ...quickActivity, type: e.target.value as ActivityType })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Call">Call</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Note">Note</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={quickActivity.activityDate}
                      onChange={(e) => setQuickActivity({ ...quickActivity, activityDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Notes *</label>
                  <textarea
                    required
                    rows={2}
                    value={quickActivity.notes}
                    onChange={(e) => setQuickActivity({ ...quickActivity, notes: e.target.value })}
                    placeholder="Log summary of conversation, next follow-up step..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  ></textarea>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingActivity}
                    className="px-3 py-1.5 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700"
                  >
                    {addingActivity ? 'Logging...' : 'Log Activity'}
                  </button>
                </div>
              </form>
            </div>

            {/* Related Activities List */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">
                Activity History ({relatedActivities.length})
              </h4>
              {loadingActivities ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading activities history...</div>
              ) : relatedActivities.length === 0 ? (
                <div className="py-6 text-center bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400">
                  No activities recorded yet for this business.
                </div>
              ) : (
                <div className="space-y-2">
                  {relatedActivities.map((act) => (
                    <div key={act.id} className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px]">
                          {act.type}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">{act.activityDate}</span>
                      </div>
                      <p className="text-slate-700">{act.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Business"
        message={`Are you sure you want to delete ${selectedBusiness?.companyName || 'this business'}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={saving}
      />

      {/* QUICK ACTIVITY LOG MODAL */}
      {activityTargetBiz && (
        <QuickActivityModal
          isOpen={!!activityTargetBiz}
          onClose={() => setActivityTargetBiz(null)}
          business={activityTargetBiz}
          user={user}
          onActivitySaved={loadBusinesses}
        />
      )}
    </div>
  );
};
