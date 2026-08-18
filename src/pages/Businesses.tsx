import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { calculateLeadHealth, exportBusinessesToCSV, calculateLeadVelocity, LeadHealthStatus, getTeamPerformanceMetrics } from '../services/intelligenceService';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { CommunicationQuickActions } from '../components/CommunicationQuickActions';
import { QuickActivityModal } from '../components/QuickActivityModal';
import { Download, ShieldAlert, HeartPulse, Hash } from 'lucide-react';

interface BusinessesProps {
  user: UserProfile;
  defaultView?: 'kanban' | 'list';
}

const PIPELINE_STAGES: { key: BusinessStatus; label: string; headerColor: string; badgeColor: string }[] = [
  { key: 'NEW', label: 'NEW LEADS', headerColor: 'bg-blue-600 text-white', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'CONTACTED', label: 'CONTACTED', headerColor: 'bg-amber-600 text-white', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'QUALIFIED', label: 'QUALIFIED', headerColor: 'bg-purple-600 text-white', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'PROPOSAL', label: 'PROPOSAL', headerColor: 'bg-indigo-600 text-white', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'WON', label: 'WON', headerColor: 'bg-emerald-600 text-white', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'LOST', label: 'LOST', headerColor: 'bg-rose-600 text-white', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' }
];

export const Businesses: React.FC<BusinessesProps> = ({ user, defaultView }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<Business[]>(() => {
    try {
      const raw = localStorage.getItem('krg_businesses_store');
      const parsed = raw ? (JSON.parse(raw) as Business[]) : [];
      return parsed
        .filter(b => b.organizationId === user.organizationId || !b.organizationId)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch {
      return [];
    }
  });
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>(() => {
    try {
      const raw = localStorage.getItem('krg_users_store');
      const parsed = raw ? (JSON.parse(raw) as UserProfile[]) : [];
      return parsed.filter(u => u.organizationId === user.organizationId);
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const raw = localStorage.getItem('krg_businesses_store');
      const parsed = raw ? JSON.parse(raw) : [];
      return parsed.length === 0;
    } catch {
      return true;
    }
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // View Mode State
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(defaultView || 'kanban');
  const [listStyle, setListStyle] = useState<'crm' | 'master'>(() => {
    try {
      const hash = window.location.hash || '';
      const queryIndex = hash.indexOf('?');
      if (queryIndex !== -1) {
        const params = new URLSearchParams(hash.slice(queryIndex));
        const style = params.get('style');
        if (style === 'master') return 'master';
      }
    } catch (e) {
      console.warn('Failed parsing list style parameter', e);
    }
    return 'crm';
  });

  useEffect(() => {
    if (defaultView) {
      setViewMode(defaultView);
    }
  }, [defaultView]);

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
  const [periodFilter, setPeriodFilter] = useState<string>('All');
  const [assignedOnlyFilter, setAssignedOnlyFilter] = useState<boolean>(false);
  const [noFollowUpFilter, setNoFollowUpFilter] = useState<boolean>(false);
  const [upcomingFilter, setUpcomingFilter] = useState<boolean>(false);
  const [allActivities, setAllActivities] = useState<Activity[]>(() => {
    try {
      const raw = localStorage.getItem('krg_activities_store');
      const parsed = raw ? (JSON.parse(raw) as Activity[]) : [];
      return parsed
        .filter(a => a.organizationId === user.organizationId || !a.organizationId)
        .sort((a, b) => new Date(b.activityDate || b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch {
      return [];
    }
  });
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
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

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
        setSuccessMessage(`Successfully synced ${res.syncedCount} business contact(s) to Cloud Database!`);
        setTimeout(() => setSuccessMessage(''), 4000);
        await loadBusinesses();
      } else {
        setSuccessMessage('All business contacts are already saved in Cloud Database.');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Error syncing to cloud:', err);
      setError(err.message || 'Failed to sync contacts to Cloud Database.');
    } finally {
      setSyncing(false);
    }
  };

  // Load Businesses & Team Members
  const loadBusinesses = async () => {
    if (!user.organizationId) return;
    try {
      if (businesses.length === 0) {
        setLoading(true);
      }
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

  // Handle URL Query Params on mount/change (e.g., ?unassigned=true, ?health=AT_RISK, etc.)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const styleParam = params.get('style');
    if (styleParam === 'master') {
      setListStyle('master');
    } else if (styleParam === 'crm') {
      setListStyle('crm');
    }
    if (params.get('unassigned') === 'true' || params.get('filter') === 'unassigned') {
      setTelecallerFilter('Unassigned');
      setSalespersonFilter('Unassigned');
    }
    if (params.get('assigned') === 'true') setAssignedOnlyFilter(true);
    if (params.get('noFollowUp') === 'true') setNoFollowUpFilter(true);
    if (params.get('upcoming') === 'true') setUpcomingFilter(true);
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
  }, [location.search]);

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

  // Pre-compute lead health and velocity using indexed lookup to avoid O(B * A) complexity in rendering loop
  const leadHealthAndVelocityMap = useMemo(() => {
    const activitiesByBizId: Record<string, Activity[]> = {};
    allActivities.forEach(a => {
      if (a.businessId) {
        if (!activitiesByBizId[a.businessId]) {
          activitiesByBizId[a.businessId] = [];
        }
        activitiesByBizId[a.businessId].push(a);
      }
    });

    const map = new Map<string, { health: LeadHealthStatus; velocity: any }>();
    businesses.forEach(b => {
      if (b.id) {
        const bizActs = activitiesByBizId[b.id] || [];
        const health = calculateLeadHealth(b, bizActs);
        const velocity = calculateLeadVelocity(b, bizActs);
        map.set(b.id, { health, velocity });
      }
    });
    return map;
  }, [businesses, allActivities]);

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
        const cached = b.id ? leadHealthAndVelocityMap.get(b.id) : null;
        const health = cached ? cached.health : 'HEALTHY';
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
        const cached = b.id ? leadHealthAndVelocityMap.get(b.id) : null;
        const velocity = cached ? cached.velocity : { daysInCurrentStage: 0 };
        matchesStuck = velocity.daysInCurrentStage >= 14 && b.status !== 'WON' && b.status !== 'Won' && b.status !== 'LOST' && b.status !== 'Lost';
      }

      // Stale Hot Filter (HOT lead with no activity for >3 days)
      let matchesStaleHot = true;
      if (staleHotFilter) {
        const isHot = (b.temperature || b.leadTemperature) === 'HOT';
        const cached = b.id ? leadHealthAndVelocityMap.get(b.id) : null;
        const health = cached ? cached.health : 'HEALTHY';
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

      // Period Filter
      let matchesPeriod = true;
      if (periodFilter !== 'All') {
        const createdDate = b.createdAt ? new Date(b.createdAt) : null;
        if (!createdDate) {
          matchesPeriod = false;
        } else {
          const now = new Date();
          if (periodFilter === 'ThisMonth') {
            matchesPeriod = createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
          } else if (periodFilter === 'Last30Days') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            matchesPeriod = createdDate >= thirtyDaysAgo;
          } else if (periodFilter === 'ThisYear') {
            matchesPeriod = createdDate.getFullYear() === now.getFullYear();
          }
        }
      }

      // Assigned Only Filter
      let matchesAssignedOnly = true;
      if (assignedOnlyFilter) {
        matchesAssignedOnly = !!(b.assignedTelecaller || b.assignedTelecallerName || b.assignedSalesperson || b.assignedSalespersonName);
      }

      // No Follow Up Filter
      let matchesNoFollowUp = true;
      if (noFollowUpFilter) {
        matchesNoFollowUp = !b.nextFollowUpDate;
      }

      // Upcoming Filter
      let matchesUpcoming = true;
      if (upcomingFilter) {
        matchesUpcoming = !!(b.nextFollowUpDate && b.nextFollowUpDate > todayStr && b.status !== 'WON' && b.status !== 'Won' && b.status !== 'LOST' && b.status !== 'Lost');
      }

      return matchesSearch && matchesStatus && matchesIndustry && matchesTemp && matchesTelecaller && matchesSalesperson && matchesHealth && matchesTag && matchesStuck && matchesStaleHot && matchesFollowUp && matchesPeriod && matchesAssignedOnly && matchesNoFollowUp && matchesUpcoming;
    });
  }, [businesses, searchQuery, statusFilter, industryFilter, temperatureFilter, telecallerFilter, salespersonFilter, leadHealthAndVelocityMap, tagFilter, stuckFilter, staleHotFilter, followUpFilter, periodFilter, assignedOnlyFilter, noFollowUpFilter, upcomingFilter, user]);

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

  // Confirm Bulk Delete Businesses
  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;

    try {
      setSaving(true);
      await Promise.all(selectedIds.map(id => businessService.deleteBusiness(id)));
      setBusinesses(prev => prev.filter(b => b.id && !selectedIds.includes(b.id)));
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      showSuccess(`Successfully deleted ${selectedIds.length} business record(s).`);
    } catch (err: any) {
      console.error('Error deleting businesses in bulk:', err);
      alert('Failed to delete some business records: ' + err.message);
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

  const handleResetFilters = () => {
    setSearchQuery('');
    setTelecallerFilter('All');
    setSalespersonFilter('All');
    setTemperatureFilter('All');
    setStatusFilter('All');
    setHealthFilter('All');
    setTagFilter('All');
    setFollowUpFilter('All');
    setIndustryFilter('All');
    setStuckFilter(false);
    setStaleHotFilter(false);
    setPeriodFilter('All');
    setAssignedOnlyFilter(false);
    setNoFollowUpFilter(false);
    setUpcomingFilter(false);
    navigate(location.pathname, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {viewMode === 'list' ? 'Contact Directory' : 'KRGONE Sales Navigator™ — SALES PIPELINE'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {viewMode === 'list' 
              ? 'View and search your complete list of organizational contacts and business directory.' 
              : 'Monitor your complete lead database, sales funnel, ownership and follow-up activity.'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer border border-amber-500 disabled:opacity-50"
            title="Sync records to Cloud Database (default)"
          >
            <CloudUpload className={`w-4 h-4 text-amber-950 ${syncing ? 'animate-bounce' : ''}`} />
            <span>
              {syncing 
                ? 'Syncing to Cloud...' 
                : unsyncedCount > 0 
                  ? `⚡ Sync ${unsyncedCount} Unsynced Records` 
                  : '⚡ Sync to Cloud Database'}
            </span>
          </button>
          <button
            onClick={() => loadBusinesses()}
            className="inline-flex items-center justify-center p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-colors"
            title="Refresh from Cloud Database"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
                Cloud Database Sync Engine
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                Target: (default)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {unsyncedCount > 0 ? (
                <span className="text-amber-300 font-semibold">
                  ⚠️ {unsyncedCount} contact(s) waiting in local cache. Click <strong>Sync Now</strong> to upload directly to Cloud Database.
                </span>
              ) : (
                <span className="text-slate-300">
                  ✓ All {businesses.length} contact records are verified and synced with your Cloud Database.
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
            title="Refresh from Cloud Database"
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
          {/* Date / Period Filter */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Time</option>
            <option value="ThisMonth">This Month (Aug 2026)</option>
            <option value="Last30Days">Last 30 Days</option>
            <option value="ThisYear">This Year</option>
          </select>

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

          {/* RESET FILTERS BUTTON */}
          <button
            onClick={handleResetFilters}
            className="px-3 py-2 text-xs font-bold rounded-lg border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-all flex items-center space-x-1.5"
            title="Reset all search and filter fields"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* VIEW SWITCHER TOGGLE */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => {
                setViewMode('kanban');
                navigate('/businesses');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1 ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Sales Pipeline Dashboard"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>
            <button
              onClick={() => {
                setViewMode('list');
                navigate('/contact-directory');
              }}
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

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <span className="bg-blue-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-md">
              {selectedIds.length} Selected
            </span>
            <span className="text-xs text-slate-300 font-bold">Bulk Actions:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Assignment Controls Group */}
            <div className="flex flex-wrap items-center gap-2 border-r border-slate-800 pr-3 mr-1">
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
            </div>

            {/* Bulk Delete Control */}
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>DELETE SELECTED</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 cursor-pointer"
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
        /* KRGONE SALES NAVIGATOR™ — EXECUTIVE LEAD MANAGEMENT INTELLIGENCE DASHBOARD */
        (() => {
          const totalDatabase = filteredBusinesses.length;
          const lostCount = filteredBusinesses.filter(b => (b.status || 'NEW').toUpperCase() === 'LOST').length;
          const totalLeads = filteredBusinesses.filter(b => (b.status || 'NEW').toUpperCase() !== 'LOST').length;

          const assignedCount = filteredBusinesses.filter(b => 
            (b.assignedSalesperson || b.assignedSalespersonName || b.assignedTelecaller || b.assignedTelecallerName) && 
            (b.status || 'NEW').toUpperCase() !== 'LOST'
          ).length;

          const unassignedCount = totalLeads - assignedCount;

          const newLeadsCount = filteredBusinesses.filter(b => (b.status || 'NEW').toUpperCase() === 'NEW').length;
          const contactedCount = filteredBusinesses.filter(b => (b.status || '').toUpperCase() === 'CONTACTED').length;
          const qualifiedCount = filteredBusinesses.filter(b => (b.status || '').toUpperCase() === 'QUALIFIED').length;
          const proposalCount = filteredBusinesses.filter(b => (b.status || '').toUpperCase() === 'PROPOSAL').length;
          const wonCount = filteredBusinesses.filter(b => (b.status || '').toUpperCase() === 'WON').length;

          const todayStr = new Date().toISOString().split('T')[0];
          const followUpsDueCount = filteredBusinesses.filter(b => 
            b.nextFollowUpDate === todayStr && 
            (b.status || 'NEW').toUpperCase() !== 'WON' && 
            (b.status || 'NEW').toUpperCase() !== 'LOST'
          ).length;

          const overdueCount = filteredBusinesses.filter(b => 
            b.nextFollowUpDate && 
            b.nextFollowUpDate < todayStr && 
            (b.status || 'NEW').toUpperCase() !== 'WON' && 
            (b.status || 'NEW').toUpperCase() !== 'LOST'
          ).length;

          const upcomingCount = filteredBusinesses.filter(b => 
            b.nextFollowUpDate && 
            b.nextFollowUpDate > todayStr && 
            (b.status || 'NEW').toUpperCase() !== 'WON' && 
            (b.status || 'NEW').toUpperCase() !== 'LOST'
          ).length;

          const noFollowUpCount = filteredBusinesses.filter(b => 
            !b.nextFollowUpDate && 
            (b.status || 'NEW').toUpperCase() !== 'WON' && 
            (b.status || 'NEW').toUpperCase() !== 'LOST'
          ).length;

          // Activity statistics (This Month)
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const currentMonthActivities = allActivities.filter(a => {
            const actDate = new Date(a.activityDate || a.createdAt);
            return actDate.getMonth() === currentMonth && actDate.getFullYear() === currentYear;
          });

          const callsCount = currentMonthActivities.filter(a => a.type === 'Call').length;
          const whatsappCount = currentMonthActivities.filter(a => a.type === 'WhatsApp').length;
          const emailCount = currentMonthActivities.filter(a => a.type === 'Email').length;
          const totalActivitiesCount = currentMonthActivities.length;

          // Lead Health statistics
          const healthyCount = filteredBusinesses.filter(b => {
            const cached = b.id ? leadHealthAndVelocityMap.get(b.id) : null;
            return (cached ? cached.health : 'HEALTHY') === 'HEALTHY';
          }).length;

          const attentionCount = filteredBusinesses.filter(b => {
            const cached = b.id ? leadHealthAndVelocityMap.get(b.id) : null;
            return (cached ? cached.health : 'HEALTHY') === 'NEEDS ATTENTION';
          }).length;

          const staleCount = filteredBusinesses.filter(b => {
            const cached = b.id ? leadHealthAndVelocityMap.get(b.id) : null;
            return (cached ? cached.health : 'HEALTHY') === 'AT RISK';
          }).length;

          const hotCount = filteredBusinesses.filter(b => 
            (b.temperature || b.leadTemperature) === 'HOT'
          ).length;

          const stuckCount = filteredBusinesses.filter(b => {
            const cached = b.id ? leadHealthAndVelocityMap.get(b.id) : null;
            const velocity = cached ? cached.velocity : { daysInCurrentStage: 0 };
            return velocity.daysInCurrentStage >= 14 && 
              (b.status || 'NEW').toUpperCase() !== 'WON' && 
              (b.status || 'NEW').toUpperCase() !== 'LOST';
          }).length;

          const salespersonMetrics = getTeamPerformanceMetrics(filteredBusinesses, allActivities, teamMembers);

          const getPercentage = (val: number, tot: number) => {
            if (tot <= 0) return '0.0%';
            return ((val / tot) * 100).toFixed(1) + '%';
          };

          const assignedPercent = totalLeads > 0 ? (assignedCount / totalLeads) * 100 : 0;

          const kpis = [
            {
              label: 'TOTAL DATABASE',
              value: totalDatabase,
              sub: 'Complete Records',
              icon: <Building2 className="w-4 h-4 text-blue-600" />,
              bg: 'bg-blue-50/70 border-blue-100 hover:bg-blue-50',
              onClick: () => navigate('/contact-directory')
            },
            {
              label: 'TOTAL LEADS',
              value: totalLeads,
              sub: 'Active & Tracked',
              icon: <UserCheck className="w-4 h-4 text-emerald-600" />,
              bg: 'bg-emerald-50/70 border-emerald-100 hover:bg-emerald-50',
              onClick: () => navigate('/contact-directory')
            },
            {
              label: 'ASSIGNED',
              value: assignedCount,
              sub: `${getPercentage(assignedCount, totalLeads)} of Total Leads`,
              icon: <User className="w-4 h-4 text-indigo-600" />,
              bg: 'bg-indigo-50/70 border-indigo-100 hover:bg-indigo-50',
              onClick: () => navigate('/contact-directory?assigned=true')
            },
            {
              label: 'UNASSIGNED',
              value: unassignedCount,
              sub: `${getPercentage(unassignedCount, totalLeads)} of Total Leads`,
              icon: <User className="w-4 h-4 text-amber-600" />,
              bg: 'bg-amber-50/70 border-amber-100 hover:bg-amber-50',
              onClick: () => navigate('/contact-directory?unassigned=true')
            },
            {
              label: 'NEW LEADS',
              value: newLeadsCount,
              sub: `${getPercentage(newLeadsCount, totalLeads)} of Total Leads`,
              icon: <Plus className="w-4 h-4 text-sky-600" />,
              bg: 'bg-sky-50/70 border-sky-100 hover:bg-sky-50',
              onClick: () => navigate('/contact-directory?status=NEW')
            },
            {
              label: 'FOLLOW-UPS DUE',
              value: followUpsDueCount,
              sub: 'Due Today',
              icon: <Calendar className="w-4 h-4 text-purple-600" />,
              bg: 'bg-purple-50/70 border-purple-100 hover:bg-purple-50',
              onClick: () => navigate('/contact-directory?filter=today')
            },
            // Row 2
            {
              label: 'CONTACTED',
              value: contactedCount,
              sub: `${getPercentage(contactedCount, totalLeads)} of Total Leads`,
              icon: <Phone className="w-4 h-4 text-indigo-600" />,
              bg: 'bg-indigo-50/70 border-indigo-100 hover:bg-indigo-50',
              onClick: () => navigate('/contact-directory?status=CONTACTED')
            },
            {
              label: 'QUALIFIED',
              value: qualifiedCount,
              sub: `${getPercentage(qualifiedCount, totalLeads)} of Total Leads`,
              icon: <CheckCircle2 className="w-4 h-4 text-purple-600" />,
              bg: 'bg-purple-50/70 border-purple-100 hover:bg-purple-50',
              onClick: () => navigate('/contact-directory?status=QUALIFIED')
            },
            {
              label: 'PROPOSAL',
              value: proposalCount,
              sub: `${getPercentage(proposalCount, totalLeads)} of Total Leads`,
              icon: <Calendar className="w-4 h-4 text-orange-600" />,
              bg: 'bg-orange-50/70 border-orange-100 hover:bg-orange-50',
              onClick: () => navigate('/contact-directory?status=PROPOSAL')
            },
            {
              label: 'WON',
              value: wonCount,
              sub: `${getPercentage(wonCount, totalLeads)} of Total Leads`,
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
              bg: 'bg-emerald-50/70 border-emerald-100 hover:bg-emerald-50',
              onClick: () => navigate('/contact-directory?status=WON')
            },
            {
              label: 'LOST',
              value: lostCount,
              sub: `${getPercentage(lostCount, totalDatabase)} of Database`,
              icon: <XCircle className="w-4 h-4 text-rose-600" />,
              bg: 'bg-rose-50/70 border-rose-100 hover:bg-rose-50',
              onClick: () => navigate('/contact-directory?status=LOST')
            },
            {
              label: 'OVERDUE',
              value: overdueCount,
              sub: 'Action Required',
              icon: <Clock className="w-4 h-4 text-rose-600" />,
              bg: 'bg-rose-50/70 border-rose-100 hover:bg-rose-50',
              onClick: () => navigate('/contact-directory?filter=overdue')
            }
          ];

          return (
            <div className="space-y-6">
              {/* Row 1: KPI Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {kpis.map(kpi => (
                  <button
                    key={kpi.label}
                    onClick={kpi.onClick}
                    className={`p-4 rounded-xl border border-slate-200/80 bg-white hover:shadow-xs transition-all flex flex-col justify-between min-h-[110px] text-left cursor-pointer group hover:scale-[1.01] active:scale-[0.99]`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                        {kpi.label}
                      </span>
                      <div className={`p-1.5 rounded-lg border border-slate-100 bg-slate-50 group-hover:scale-110 transition-transform`}>
                        {kpi.icon}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-xl font-black text-slate-900 tracking-tight">
                        {kpi.value.toLocaleString()}
                      </span>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5 line-clamp-1">
                        {kpi.sub}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Row 2: Sales Funnel, Lead Ownership, Salesperson Workload */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Visual Sales Funnel (lg:col-span-4) */}
                <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">
                      Sales Funnel Analytics
                    </h3>
                    <div className="space-y-2 flex flex-col">
                      {/* Funnel Stage 1: Total Leads */}
                      <div 
                        onClick={() => navigate('/contact-directory')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-3 flex items-center justify-between cursor-pointer transition-transform hover:scale-[1.01]"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">1. Total Leads</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-sm font-black">{totalLeads}</span>
                          <span className="text-[9px] font-bold opacity-80">(100.0%)</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center -my-1">
                        <div className="w-2.5 h-2.5 bg-slate-100 border-r border-b border-slate-200 rotate-45"></div>
                      </div>

                      {/* Funnel Stage 2: New Leads */}
                      <div 
                        onClick={() => navigate('/contact-directory?status=NEW')}
                        className="w-[95%] mx-auto bg-blue-500 hover:bg-blue-600 text-white rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-transform hover:scale-[1.01]"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">2. New Leads</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black">{newLeadsCount}</span>
                          <span className="text-[9px] font-bold opacity-80">({getPercentage(newLeadsCount, totalLeads)})</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center -my-1">
                        <div className="w-2.5 h-2.5 bg-slate-100 border-r border-b border-slate-200 rotate-45"></div>
                      </div>

                      {/* Funnel Stage 3: Contacted */}
                      <div 
                        onClick={() => navigate('/contact-directory?status=CONTACTED')}
                        className="w-[90%] mx-auto bg-sky-500 hover:bg-sky-600 text-white rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-transform hover:scale-[1.01]"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">3. Contacted</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black">{contactedCount}</span>
                          <span className="text-[9px] font-bold opacity-80">({getPercentage(contactedCount, totalLeads)})</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center -my-1">
                        <div className="w-2.5 h-2.5 bg-slate-100 border-r border-b border-slate-200 rotate-45"></div>
                      </div>

                      {/* Funnel Stage 4: Qualified */}
                      <div 
                        onClick={() => navigate('/contact-directory?status=QUALIFIED')}
                        className="w-[85%] mx-auto bg-purple-500 hover:bg-purple-600 text-white rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-transform hover:scale-[1.01]"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">4. Qualified</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black">{qualifiedCount}</span>
                          <span className="text-[9px] font-bold opacity-80">({getPercentage(qualifiedCount, totalLeads)})</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center -my-1">
                        <div className="w-2.5 h-2.5 bg-slate-100 border-r border-b border-slate-200 rotate-45"></div>
                      </div>

                      {/* Funnel Stage 5: Proposal */}
                      <div 
                        onClick={() => navigate('/contact-directory?status=PROPOSAL')}
                        className="w-[80%] mx-auto bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-transform hover:scale-[1.01]"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">5. Proposal</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black">{proposalCount}</span>
                          <span className="text-[9px] font-bold opacity-80">({getPercentage(proposalCount, totalLeads)})</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center -my-1">
                        <div className="w-2.5 h-2.5 bg-slate-100 border-r border-b border-slate-200 rotate-45"></div>
                      </div>

                      {/* Funnel Stage 6: Won */}
                      <div 
                        onClick={() => navigate('/contact-directory?status=WON')}
                        className="w-[75%] mx-auto bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-transform hover:scale-[1.01]"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">6. Won</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black">{wonCount}</span>
                          <span className="text-[9px] font-bold opacity-80">({getPercentage(wonCount, totalLeads)})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Conversion</span>
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-black">
                      {getPercentage(wonCount, totalLeads)} Won
                    </span>
                  </div>
                </div>

                {/* Lead Ownership Center Segment (lg:col-span-3) */}
                <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">
                      Lead Assignment
                    </h3>
                    
                    {/* SVG Circular Donut Chart */}
                    <div className="relative flex items-center justify-center py-4">
                      <svg viewBox="0 0 36 36" className="w-28 h-28 transform -rotate-90">
                        {/* Background track */}
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                        {/* Assigned Segment */}
                        <circle 
                          cx="18" 
                          cy="18" 
                          r="15.9155" 
                          fill="none" 
                          stroke="#2563eb" 
                          strokeWidth="4"
                          strokeDasharray={`${assignedPercent} ${100 - assignedPercent}`} 
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-xl font-black text-slate-800">{assignedPercent.toFixed(1)}%</span>
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Assigned</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={() => navigate('/contact-directory?assigned=true')}
                      className="w-full p-2.5 bg-blue-50/50 hover:bg-blue-50 border border-blue-100/50 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="text-[10px] font-bold text-slate-600">Assigned Leads</span>
                      </div>
                      <span className="text-xs font-black text-blue-600">{assignedCount}</span>
                    </button>

                    <button 
                      onClick={() => navigate('/contact-directory?unassigned=true')}
                      className="w-full p-2.5 bg-amber-50/50 hover:bg-amber-50 border border-amber-100/50 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-[10px] font-bold text-slate-600">Unassigned Leads</span>
                      </div>
                      <span className="text-xs font-black text-amber-600">{unassignedCount}</span>
                    </button>
                  </div>
                </div>

                {/* Salesperson Workload (lg:col-span-5) */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3">
                      Salesperson Workload & Productivity
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-extrabold text-[8px]">
                            <th className="pb-2">Salesperson</th>
                            <th className="pb-2 text-right">Assigned</th>
                            <th className="pb-2 text-right">Contacted</th>
                            <th className="pb-2 text-right text-emerald-600">Won</th>
                            <th className="pb-2 text-right">Due</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-700 font-semibold">
                          {salespersonMetrics.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-slate-400 text-[10px]">
                                No salesperson records found.
                              </td>
                            </tr>
                          ) : (
                            salespersonMetrics.slice(0, 5).map(m => (
                              <tr key={m.user.uid} className="hover:bg-slate-50/30 transition-colors">
                                <td className="py-2.5 flex items-center space-x-1.5">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[9px] text-slate-600">
                                    {m.user.name?.charAt(0) || m.user.email?.charAt(0) || 'U'}
                                  </span>
                                  <span className="text-slate-800 line-clamp-1 max-w-[100px]" title={m.user.name || m.user.email}>
                                    {m.user.name || m.user.email}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right font-black">{m.assignedLeads}</td>
                                <td className="py-2.5 text-right">{m.contactedLeads}</td>
                                <td className="py-2.5 text-right font-bold text-emerald-600">{m.wonDeals}</td>
                                <td className="py-2.5 text-right text-purple-600">{m.followUpsDue}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={() => navigate('/contact-directory')}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center space-x-1"
                    >
                      <span>View complete lead hierarchy</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Detail Distributions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Status Bar Meters */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">
                    Lead Status Distribution
                  </h3>
                  <div className="space-y-3.5">
                    {[
                      { label: 'New Leads', count: newLeadsCount, color: 'bg-blue-500' },
                      { label: 'Contacted', count: contactedCount, color: 'bg-sky-400' },
                      { label: 'Qualified', count: qualifiedCount, color: 'bg-purple-500' },
                      { label: 'Proposal', count: proposalCount, color: 'bg-orange-400' },
                      { label: 'Won Leads', count: wonCount, color: 'bg-emerald-500' },
                      { label: 'Lost Leads', count: lostCount, color: 'bg-rose-500' }
                    ].map(status => {
                      const pct = totalDatabase > 0 ? (status.count / totalDatabase) * 100 : 0;
                      return (
                        <div key={status.label} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-600">
                            <span>{status.label}</span>
                            <span>{status.count} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${status.color}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lead Health Indicators */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">
                    Lead Health Overview
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Healthy Leads', count: healthyCount, desc: 'Active communication established', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', onClick: () => navigate('/contact-directory?health=HEALTHY') },
                      { label: 'Needs Attention', count: attentionCount, desc: 'Pending verification / action', color: 'text-amber-600 bg-amber-50 border-amber-100', onClick: () => navigate('/contact-directory?health=NEEDS%20ATTENTION') },
                      { label: 'At Risk / Stale', count: staleCount, desc: 'No communication in 14+ days', color: 'text-rose-600 bg-rose-50 border-rose-100', onClick: () => navigate('/contact-directory?health=AT%20RISK') },
                      { label: 'Hot Priority Leads', count: hotCount, desc: 'Highly interested prospects', color: 'text-orange-600 bg-orange-50 border-orange-100', onClick: () => navigate('/contact-directory?temp=HOT') },
                      { label: 'Stuck Stages', count: stuckCount, desc: 'Unchanged pipeline stage for 14d+', color: 'text-purple-600 bg-purple-50 border-purple-100', onClick: () => navigate('/contact-directory?stuck=true') }
                    ].map(health => (
                      <button
                        key={health.label}
                        onClick={health.onClick}
                        className={`w-full p-2.5 rounded-xl border ${health.color} text-left flex items-center justify-between cursor-pointer hover:scale-[1.01] transition-transform`}
                      >
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider">{health.label}</span>
                          <p className="text-[9px] font-medium opacity-80 leading-none mt-0.5">{health.desc}</p>
                        </div>
                        <span className="text-sm font-black">{health.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Today's Actions & Month Activities */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3">
                      Today's Follow-up Activity
                    </h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <button 
                        onClick={() => navigate('/contact-directory?filter=today')}
                        className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-left cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Due Today</span>
                        <span className="block text-base font-black text-slate-800 mt-1">{followUpsDueCount}</span>
                      </button>
                      <button 
                        onClick={() => navigate('/contact-directory?filter=overdue')}
                        className="p-3 bg-red-50 border border-red-100 rounded-xl text-left cursor-pointer hover:bg-red-100/50 transition-colors"
                      >
                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Overdue</span>
                        <span className="block text-base font-black text-red-600 mt-1">{overdueCount}</span>
                      </button>
                    </div>

                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2.5">
                      Completed Actions (This Month)
                    </h3>
                    <div className="space-y-1.5 text-[10px] font-semibold text-slate-600">
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="flex items-center space-x-1.5 text-slate-500">
                          <Phone className="w-3.5 h-3.5" />
                          <span>Calls Placed</span>
                        </span>
                        <span className="font-bold text-slate-800">{callsCount}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="flex items-center space-x-1.5 text-slate-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>WhatsApp Follow-ups</span>
                        </span>
                        <span className="font-bold text-slate-800">{whatsappCount}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="flex items-center space-x-1.5 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Emails Sent</span>
                        </span>
                        <span className="font-bold text-slate-800">{emailCount}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 text-slate-800 font-bold">
                        <span>Total Monthly Logged Actions</span>
                        <span className="text-xs font-black text-blue-600">{totalActivitiesCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Pipeline Attention & Action Alerts */}
              <div className="bg-amber-50/20 border border-amber-200/80 rounded-2xl p-4">
                <h3 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-3 flex items-center space-x-1.5">
                  <span className="text-amber-500 font-extrabold text-sm">⚠</span>
                  <span>Pipeline Attention Alerts</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    {
                      condition: unassignedCount > 0,
                      label: `${unassignedCount} Leads Unassigned`,
                      desc: 'Assign sales representatives',
                      onClick: () => navigate('/contact-directory?unassigned=true'),
                      color: 'bg-amber-50/70 border-amber-200/70 text-amber-800 hover:bg-amber-100/50'
                    },
                    {
                      condition: noFollowUpCount > 0,
                      label: `${noFollowUpCount} Missing Follow-ups`,
                      desc: 'Schedule next contact date',
                      onClick: () => navigate('/contact-directory?noFollowUp=true'),
                      color: 'bg-amber-50/70 border-amber-200/70 text-amber-800 hover:bg-amber-100/50'
                    },
                    {
                      condition: overdueCount > 0,
                      label: `${overdueCount} Overdue Follow-ups`,
                      desc: 'Urgent callbacks required',
                      onClick: () => navigate('/contact-directory?filter=overdue'),
                      color: 'bg-red-50/70 border-red-200/70 text-red-800 hover:bg-red-100/50'
                    },
                    {
                      condition: qualifiedCount === 0,
                      label: 'No Leads Qualified',
                      desc: 'Establish pipeline velocity',
                      onClick: () => navigate('/contact-directory?status=QUALIFIED'),
                      color: 'bg-indigo-50/70 border-indigo-200/70 text-indigo-800 hover:bg-indigo-100/50'
                    },
                    {
                      condition: proposalCount > 0,
                      label: `${proposalCount} Proposals Awaiting`,
                      desc: 'Follow-up on open proposals',
                      onClick: () => navigate('/contact-directory?status=PROPOSAL'),
                      color: 'bg-blue-50/70 border-blue-200/70 text-blue-800 hover:bg-blue-100/50'
                    }
                  ].map((alert, idx) => {
                    if (!alert.condition) return null;
                    return (
                      <button
                        key={idx}
                        onClick={alert.onClick}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-transform hover:scale-[1.01] flex flex-col justify-between ${alert.color}`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">{alert.label}</span>
                        <span className="text-[9px] font-semibold opacity-75 mt-0.5 leading-none">{alert.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        /* DIRECTORY TABLE VIEW */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Sub-view Switcher inside Directory */}
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700">Directory Mode:</span>
              <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setListStyle('crm');
                    navigate('/contact-directory?style=crm');
                  }}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    listStyle === 'crm'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-850'
                  }`}
                >
                  Intel & Follow-ups
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setListStyle('master');
                    navigate('/contact-directory?style=master');
                  }}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    listStyle === 'master'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-850'
                  }`}
                >
                  🗂️ Lead Data Master
                </button>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-semibold">
              {listStyle === 'crm' 
                ? 'Displaying pipeline statuses, dynamic health tags, communication logs, and active follow-up actions.' 
                : 'Displaying exact tabular form with separate columns for Company, Contact Person, Mobile, Email, City, and Industry.'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                {listStyle === 'crm' ? (
                  <tr>
                    <th className="px-3 py-3.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
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
                ) : (
                  <tr>
                    <th className="px-3 py-3.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        title={selectedIds.length === filteredBusinesses.length && filteredBusinesses.length > 0 ? 'Deselect all' : 'Select all'}
                      >
                        {selectedIds.length === filteredBusinesses.length && filteredBusinesses.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 fill-blue-50" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3.5">Company Name</th>
                    <th className="px-4 py-3.5">Contact Person</th>
                    <th className="px-4 py-3.5">Mobile</th>
                    <th className="px-4 py-3.5">Email</th>
                    <th className="px-4 py-3.5">City</th>
                    <th className="px-4 py-3.5">Industry</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                )}
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
                        className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        {biz.id && selectedIds.includes(biz.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 fill-blue-50" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {listStyle === 'crm' ? (
                      <>
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
                            const cached = biz.id ? leadHealthAndVelocityMap.get(biz.id) : null;
                            const h = cached ? cached.health : 'HEALTHY';
                            const vel = cached ? cached.velocity : { totalAgeDays: 0, daysInCurrentStage: 0 };
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
                            business={biz}
                            currentUser={user}
                            mobile={biz.mobile}
                            email={biz.email}
                            contactPerson={biz.contactPerson}
                            companyName={biz.companyName}
                            leadStatus={biz.status}
                            onLogActivity={() => setActivityTargetBiz(biz)}
                            onBusinessUpdated={(bizId, updates) => {
                              setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, ...updates } : b));
                            }}
                            onActivityLogged={(newAct) => {
                              setAllActivities(prev => [newAct, ...prev]);
                            }}
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
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleOpenView(biz)}
                            className="font-bold text-slate-900 hover:text-blue-600 hover:underline transition-colors text-left text-xs cursor-pointer"
                          >
                            {biz.companyName}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-slate-800 text-xs font-semibold">
                          {biz.contactPerson || <span className="text-slate-400 italic font-normal">-</span>}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-mono text-slate-600">
                          {biz.mobile ? (
                            <a href={`tel:${biz.mobile}`} className="hover:text-blue-600 hover:underline flex items-center">
                              <Phone className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                              <span>{biz.mobile}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic font-normal">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {biz.email ? (
                            <a href={`mailto:${biz.email}`} className="hover:text-blue-600 hover:underline flex items-center">
                              <MailIcon className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                              <span className="truncate max-w-[150px]" title={biz.email}>{biz.email}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic font-normal">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-800 text-xs">
                          {biz.city || <span className="text-slate-400 italic font-normal">-</span>}
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          {biz.industry ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200 font-bold text-[10px]">
                              {biz.industry}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic font-normal">-</span>
                          )}
                        </td>
                      </>
                    )}

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenView(biz)}
                          title="View Detail"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(biz)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(biz)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
                  business={selectedBusiness}
                  currentUser={user}
                  mobile={selectedBusiness.mobile}
                  email={selectedBusiness.email}
                  contactPerson={selectedBusiness.contactPerson}
                  companyName={selectedBusiness.companyName}
                  leadStatus={selectedBusiness.status}
                  onLogActivity={() => setActivityTargetBiz(selectedBusiness)}
                  onBusinessUpdated={(bizId, updates) => {
                    setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, ...updates } : b));
                    setSelectedBusiness(prev => prev ? { ...prev, ...updates } : null);
                  }}
                  onActivityLogged={(newAct) => {
                    setAllActivities(prev => [newAct, ...prev]);
                    setRelatedActivities(prev => [newAct, ...prev]);
                  }}
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

      {/* BULK DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title="Delete Multiple Businesses"
        message={`Are you sure you want to delete the ${selectedIds.length} selected business record(s)? This action cannot be undone.`}
        confirmText="Delete Selected"
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
