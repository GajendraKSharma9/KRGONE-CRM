import React, { useState, useEffect, useMemo } from 'react';
import { 
  Target, 
  TrendingUp, 
  Users, 
  Award, 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  List, 
  Clock,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Shield,
  Search,
  Filter,
  MessageSquare,
  FileDown,
  Wrench,
  X,
  Activity as ActivityIcon,
  HelpCircle,
  TrendingDown,
  IndianRupee,
  Globe,
  Box,
  Trophy,
  Crown,
  Grid3X3,
  PlusCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { UserProfile, Business, Activity, KPI, SalesTarget, AchievementEntry, TeamReview } from '../types';
import { PerformanceReportsView } from '../components/PerformanceReportsView';
import { businessService } from '../services/businessService';
import { activityService } from '../services/activityService';
import { authService } from '../services/authService';
import { performanceService } from '../services/performanceService';

interface SalesPerformanceProps {
  user: UserProfile;
  tab?: 'dashboard' | 'target-setting' | 'achievement-entry' | 'team-review' | 'reports' | 'settings';
}

export const SalesPerformance: React.FC<SalesPerformanceProps> = ({ user, tab = 'dashboard' }) => {
  // Map routing tab to internal active tab
  const activeTab = tab;

  // Period filter for sub-monthly tracking (proportionally allocated targets)
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month'>('month');

  // Core States
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [achievements, setAchievements] = useState<AchievementEntry[]>([]);
  const [reviews, setReviews] = useState<TeamReview[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Targets Settings and Dashboard Month (Default to current month "YYYY-MM")
  const [targetPeriod, setTargetPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [dashboardMonth, setDashboardMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Dashboard filters
  const [dashboardKpiId, setDashboardKpiId] = useState<string>('all');
  const [dashboardSalespersonUid, setDashboardSalespersonUid] = useState<string>('');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<string>('all');

  // KPI Settings states
  const [newKpiName, setNewKpiName] = useState('');
  const [newKpiUnit, setNewKpiUnit] = useState<'Currency' | 'Number' | 'Percentage'>('Currency');
  const [kpiSearchText, setKpiSearchText] = useState('');
  const [kpiStatusFilter, setKpiStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Targets Matrix Temporary State
  const [editedTargets, setEditedTargets] = useState<Record<string, number>>({});

  // Achievement Matrix states
  const [achMatrixMode, setAchMatrixMode] = useState<'matrix' | 'single'>('matrix'); // Default to bulk matrix spreadsheet entry for fast updates
  const [achPeriodMonth, setAchPeriodMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editedAchievements, setEditedAchievements] = useState<Record<string, number>>({});

  // Achievement log entry state
  const [logForm, setLogForm] = useState({
    salespersonUid: user.role === 'Salesperson' ? user.uid : '',
    kpiId: '',
    value: '' as number | '',
    date: new Date().toISOString().split('T')[0],
    customerClient: '',
    product: '',
    supportingReference: '',
    notes: ''
  });
  const [showAdvancedLog, setShowAdvancedLog] = useState(false);

  // Comment overlay states
  const [activeCommentTargetId, setActiveCommentTargetId] = useState<string | null>(null);
  const [tempCommentText, setTempCommentText] = useState('');

  // Team Review Modal States
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewSalesperson, setSelectedReviewSalesperson] = useState<UserProfile | null>(null);
  const [selectedReviewKpiId, setSelectedReviewKpiId] = useState<string>('');
  const [reviewReason, setReviewReason] = useState<string>('');
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewActionPlan, setReviewActionPlan] = useState<string>('');
  const [reviewSupportRequired, setReviewSupportRequired] = useState<string>('');
  const [reviewNextDate, setReviewNextDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [reviewStatusState, setReviewStatusState] = useState<'Open' | 'Monitoring' | 'Improved' | 'Closed'>('Open');
  const [reviewPriorityState, setReviewPriorityState] = useState<'Normal' | 'High' | 'Medium' | 'Low'>('Normal');
  const [reviewDateState, setReviewDateState] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Review History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historySalesperson, setHistorySalesperson] = useState<UserProfile | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Reports Internal Sub-Tabs & Selectors
  const [reportsSubTab, setReportsSubTab] = useState<'leaderboard' | 'charts' | 'drilldown' | 'ai-insights'>('leaderboard');
  const [selectedReportSalespersonUid, setSelectedReportSalespersonUid] = useState<string>('');

  // Team Review Filter States
  const [reviewFilterSalesperson, setReviewFilterSalesperson] = useState<string>('all');
  const [reviewFilterStatus, setReviewFilterStatus] = useState<string>('all');
  const [reviewFilterKpi, setReviewFilterKpi] = useState<string>('all');
  const [reviewQuickFilter, setReviewQuickFilter] = useState<'all' | 'below_target' | 'needs_attention' | 'on_track' | 'overdue' | 'no_review'>('all');

  // Threshold Settings (Persisted in LocalStorage)
  const [onTrackThreshold, setOnTrackThreshold] = useState<number>(() => {
    const stored = localStorage.getItem('krg_perf_ontrack_threshold');
    return stored ? Number(stored) : 90;
  });
  const [needsAttentionThreshold, setNeedsAttentionThreshold] = useState<number>(() => {
    const stored = localStorage.getItem('krg_perf_attention_threshold');
    return stored ? Number(stored) : 70;
  });

  // Load all performance and baseline CRM data
  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const orgId = user.organizationId;
      if (!orgId) return;

      const [kpiList, targetList, achList, team, biz, act, reviewList] = await Promise.all([
        performanceService.getKPIs(orgId),
        performanceService.getTargets(orgId),
        performanceService.getAchievements(orgId),
        authService.getTeamMembers(orgId),
        businessService.getBusinesses(orgId),
        activityService.getActivities(orgId),
        performanceService.getTeamReviews(orgId)
      ]);

      setKpis(kpiList);
      setTargets(targetList);
      setAchievements(achList);
      setTeamMembers(team);
      setBusinesses(biz);
      setActivities(act);
      setReviews(reviewList || []);
    } catch (err: any) {
      console.error('Failed to load performance data:', err);
      setErrorMsg(err.message || 'Error loading dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.organizationId]);

  // Sync edited targets state whenever targets list or selected month period changes
  useEffect(() => {
    const initialMatrix: Record<string, number> = {};
    const salespeople = teamMembers.filter(m => m.role === 'Salesperson');
    salespeople.forEach(sp => {
      kpis.forEach(k => {
        const existing = targets.find(t => t.salespersonUid === sp.uid && t.kpiId === k.id && t.period === targetPeriod);
        initialMatrix[`${sp.uid}::${k.id}`] = existing ? existing.targetValue : 0;
      });
    });
    setEditedTargets(initialMatrix);
  }, [targets, targetPeriod, teamMembers, kpis]);

  // Sync edited achievements state whenever achievements list or selected month period changes
  useEffect(() => {
    const initialMatrix: Record<string, number> = {};
    const salespeople = teamMembers.filter(m => m.role === 'Salesperson');
    salespeople.forEach(sp => {
      kpis.forEach(k => {
        // Find and sum up achievements for this month
        const matchingLogs = achievements.filter(a =>
          a.salespersonUid === sp.uid &&
          a.kpiId === k.id &&
          (a.date || '').substring(0, 7) === achPeriodMonth
        );
        const totalValue = matchingLogs.reduce((acc, curr) => acc + (curr.value || 0), 0);
        initialMatrix[`${sp.uid}::${k.id}`] = totalValue;
      });
    });
    setEditedAchievements(initialMatrix);
  }, [achievements, achPeriodMonth, teamMembers, kpis]);

  // Date Range calculation for proportional sub-monthly targets
  const periodDateRanges = useMemo(() => {
    const today = new Date();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const currentDay = today.getDay();
    const diffToSunday = today.getDate() - currentDay;
    const weekStart = new Date(today.setDate(diffToSunday));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      today: { start: todayStart, end: todayEnd },
      week: { start: weekStart, end: weekEnd },
      month: { start: monthStart, end: monthEnd }
    };
  }, []);

  const isDateInPeriodRange = (dateStr: string, period: 'today' | 'week' | 'month') => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const range = periodDateRanges[period];
    return d >= range.start && d <= range.end;
  };

  // Helper to format values dynamically based on unit
  const formatValue = (val: number, unit: string) => {
    if (unit === 'Currency') {
      return `₹${val.toLocaleString('en-IN')}`;
    }
    if (unit === 'Percentage') {
      return `${val}%`;
    }
    return val.toLocaleString('en-IN');
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  // Dynamic calculations: aggregates both CRM baseline pipelines AND manual log overrides
  const calculatePeriodPerformance = (salespersonUid: string, kpi: KPI, periodMonth: string) => {
    const targetDoc = targets.find(t => 
      t.salespersonUid === salespersonUid && 
      t.kpiId === kpi.id && 
      t.period === periodMonth &&
      t.organizationId === user.organizationId
    );

    const hasTarget = !!targetDoc && targetDoc.targetValue > 0;
    const target = targetDoc ? targetDoc.targetValue : 0;
    let achievement = 0;

    // Standard baseline integrations
    const isRevenueKpi = kpi.name.toLowerCase().includes('revenue') || kpi.name.toLowerCase().includes('sales');
    const isOnboardingKpi = kpi.name.toLowerCase().includes('onboarding') || kpi.name.toLowerCase().includes('client');
    const isMeetingKpi = kpi.name.toLowerCase().includes('meeting') || kpi.name.toLowerCase().includes('call') || kpi.name.toLowerCase().includes('activity');

    if (isRevenueKpi) {
      const matchingBiz = businesses.filter(b => 
        b.organizationId === user.organizationId &&
        b.assignedSalespersonId === salespersonUid && 
        (b.status === 'WON' || b.status === 'Won') &&
        (b.updatedAt || b.createdAt || '').substring(0, 7) === periodMonth
      );
      achievement += matchingBiz.reduce((sum, b) => sum + (b.dealValue || 0), 0);
    } else if (isOnboardingKpi) {
      const matchingBiz = businesses.filter(b => 
        b.organizationId === user.organizationId &&
        b.assignedSalespersonId === salespersonUid && 
        (b.status === 'WON' || b.status === 'Won') &&
        (b.updatedAt || b.createdAt || '').substring(0, 7) === periodMonth
      );
      achievement += matchingBiz.length;
    } else if (isMeetingKpi) {
      const matchingAct = activities.filter(a => 
        a.organizationId === user.organizationId &&
        a.userId === salespersonUid && 
        (a.activityDate || a.createdAt || '').substring(0, 7) === periodMonth
      );
      achievement += matchingAct.length;
    }

    // Manual manual logs additions (Supports hybrid tracking)
    const manualLogs = achievements.filter(a => 
      a.organizationId === user.organizationId &&
      a.salespersonUid === salespersonUid && 
      a.kpiId === kpi.id && 
      (a.date || '').substring(0, 7) === periodMonth
    );
    const manualSum = manualLogs.reduce((sum, m) => sum + m.value, 0);

    if (manualSum > 0 || (!isRevenueKpi && !isOnboardingKpi && !isMeetingKpi)) {
      if (isRevenueKpi || isOnboardingKpi || isMeetingKpi) {
        achievement += manualSum;
      } else {
        achievement = manualSum;
      }
    }

    let gap = 0;
    let achievementPercent = 0;
    
    if (hasTarget && target > 0) {
      gap = Math.max(target - achievement, 0);
      achievementPercent = Math.round((achievement / target) * 100);
    }

    // Performance Grades status classification
    let status: 'GREEN' | 'YELLOW' | 'RED' | 'NO_TARGET' = 'RED';
    if (!hasTarget || target === 0) {
      status = 'NO_TARGET';
    } else if (achievementPercent >= onTrackThreshold) {
      status = 'GREEN';
    } else if (achievementPercent >= needsAttentionThreshold) {
      status = 'YELLOW';
    }

    return {
      id: targetDoc?.id || '',
      hasTarget,
      target,
      achievement,
      gap,
      achievementPercent,
      status,
      managerComment: targetDoc?.managerComment || ''
    };
  };

  // Proportionally allocate targets for Daily/Weekly trackers
  const calculateProportionalMetrics = (salespersonUid: string, kpi: KPI, period: 'today' | 'week' | 'month') => {
    const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const monthlyTargetDoc = targets.find(t => 
      t.salespersonUid === salespersonUid && 
      t.kpiId === kpi.id && 
      t.period === currentMonthStr &&
      t.organizationId === user.organizationId
    );

    const baseMonthlyTargetValue = monthlyTargetDoc ? monthlyTargetDoc.targetValue : 0;
    const hasTarget = !!monthlyTargetDoc && baseMonthlyTargetValue > 0;
    let target = 0;

    if (period === 'month') {
      target = baseMonthlyTargetValue;
    } else if (period === 'week') {
      target = Math.round((baseMonthlyTargetValue / 4) * 10) / 10;
    } else {
      target = Math.round((baseMonthlyTargetValue / 30) * 10) / 10;
    }

    let achievement = 0;
    const isRevenueKpi = kpi.name.toLowerCase().includes('revenue') || kpi.name.toLowerCase().includes('sales');
    const isOnboardingKpi = kpi.name.toLowerCase().includes('onboarding') || kpi.name.toLowerCase().includes('client');
    const isMeetingKpi = kpi.name.toLowerCase().includes('meeting') || kpi.name.toLowerCase().includes('call') || kpi.name.toLowerCase().includes('activity');

    if (isRevenueKpi) {
      const matchingBiz = businesses.filter(b => 
        b.organizationId === user.organizationId &&
        b.assignedSalespersonId === salespersonUid && 
        (b.status === 'WON' || b.status === 'Won') &&
        isDateInPeriodRange(b.updatedAt || b.createdAt, period)
      );
      achievement += matchingBiz.reduce((sum, b) => sum + (b.dealValue || 0), 0);
    } else if (isOnboardingKpi) {
      const matchingBiz = businesses.filter(b => 
        b.organizationId === user.organizationId &&
        b.assignedSalespersonId === salespersonUid && 
        (b.status === 'WON' || b.status === 'Won') &&
        isDateInPeriodRange(b.updatedAt || b.createdAt, period)
      );
      achievement += matchingBiz.length;
    } else if (isMeetingKpi) {
      const matchingAct = activities.filter(a => 
        a.organizationId === user.organizationId &&
        a.userId === salespersonUid && 
        isDateInPeriodRange(a.activityDate || a.createdAt, period)
      );
      achievement += matchingAct.length;
    }

    const manualLogsInPeriod = achievements.filter(a => 
      a.organizationId === user.organizationId &&
      a.salespersonUid === salespersonUid && 
      a.kpiId === kpi.id && 
      isDateInPeriodRange(a.date, period)
    );
    const manualSum = manualLogsInPeriod.reduce((sum, m) => sum + m.value, 0);

    if (manualSum > 0 || (!isRevenueKpi && !isOnboardingKpi && !isMeetingKpi)) {
      if (isRevenueKpi || isOnboardingKpi || isMeetingKpi) {
        achievement += manualSum;
      } else {
        achievement = manualSum;
      }
    }

    let gap = 0;
    let achievementPercent = 0;
    if (hasTarget && target > 0) {
      gap = Math.max(target - achievement, 0);
      achievementPercent = Math.round((achievement / target) * 100);
    }

    let status: 'GREEN' | 'YELLOW' | 'RED' | 'NO_TARGET' = 'RED';
    if (!hasTarget || target === 0) {
      status = 'NO_TARGET';
    } else if (achievementPercent >= onTrackThreshold) {
      status = 'GREEN';
    } else if (achievementPercent >= needsAttentionThreshold) {
      status = 'YELLOW';
    }

    return {
      hasTarget,
      target,
      achievement,
      gap,
      achievementPercent,
      status
    };
  };

  // Style helper for visual status pills
  const getStatusStyle = (status: string) => {
    if (status === 'GREEN') {
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        label: '🟢 ON TRACK'
      };
    }
    if (status === 'YELLOW') {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        label: '🟡 NEEDS ATTENTION'
      };
    }
    if (status === 'NO_TARGET') {
      return {
        bg: 'bg-slate-100 text-slate-500 border-slate-300',
        dot: 'bg-slate-400',
        label: '⚪ NO TARGET'
      };
    }
    return {
      bg: 'bg-rose-50 text-rose-800 border-rose-200',
      dot: 'bg-rose-500',
      label: '🔴 BELOW TARGET'
    };
  };

  // Add Custom KPI
  const handleCreateKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKpiName.trim()) return;

    try {
      setSaving(true);
      setErrorMsg('');
      const created = await performanceService.addKPI(user.organizationId, newKpiName, newKpiUnit);
      setKpis(prev => [...prev, created]);
      setNewKpiName('');
      setSuccessMsg(`KPI "${created.name}" created successfully!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create Custom KPI.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTeamReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewSalesperson) return;

    const kpi = kpis.find(k => k.id === selectedReviewKpiId);
    if (!kpi) {
      setErrorMsg('Please select a KPI to review.');
      return;
    }

    const performance = calculatePeriodPerformance(selectedReviewSalesperson.uid, kpi, dashboardMonth);

    try {
      setSaving(true);
      setErrorMsg('');
      const reviewPayload = {
        salespersonUid: selectedReviewSalesperson.uid,
        salespersonName: selectedReviewSalesperson.name || selectedReviewSalesperson.email,
        kpiId: kpi.id,
        kpiName: kpi.name,
        target: performance.target,
        achievement: performance.achievement,
        gap: performance.gap,
        completionPercentage: performance.achievementPercent,
        status: (performance.status === 'GREEN' ? 'ON TRACK' : performance.status === 'YELLOW' ? 'NEEDS ATTENTION' : 'BELOW TARGET') as 'ON TRACK' | 'NEEDS ATTENTION' | 'BELOW TARGET',
        reason: reviewReason,
        managerComment: reviewComment,
        actionPlan: reviewActionPlan,
        supportRequired: reviewSupportRequired,
        reviewDate: reviewDateState,
        nextReviewDate: reviewNextDate,
        reviewStatus: reviewStatusState,
        priority: reviewPriorityState,
        createdBy: user.name || user.email,
      };

      const saved = await performanceService.saveTeamReview(user.organizationId, reviewPayload);
      setReviews(prev => {
        const filtered = prev.filter(r => r.id !== saved.id);
        return [...filtered, saved];
      });

      setSuccessMsg(`Review for ${selectedReviewSalesperson.name || selectedReviewSalesperson.email} saved successfully!`);
      setIsReviewModalOpen(false);
      
      // Clear form
      setReviewReason('');
      setReviewComment('');
      setReviewActionPlan('');
      setReviewSupportRequired('');
      setReviewPriorityState('Normal');
      setReviewDateState(new Date().toISOString().split('T')[0]);
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save team review.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle KPI active status
  const handleToggleKpi = async (kpiId: string, currentActive: boolean) => {
    try {
      setErrorMsg('');
      await performanceService.updateKPI(kpiId, { active: !currentActive });
      setKpis(prev => prev.map(k => k.id === kpiId ? { ...k, active: !currentActive } : k));
      setSuccessMsg('KPI status updated.');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setErrorMsg('Failed to update KPI status.');
    }
  };

  // Delete Custom KPI
  const handleDeleteKpi = async (kpiId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this KPI objective? All assigned targets will remain unlinked.')) return;
    try {
      setErrorMsg('');
      await performanceService.deleteKPI(kpiId);
      setKpis(prev => prev.filter(k => k.id !== kpiId));
      setSuccessMsg('KPI removed from organization.');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setErrorMsg('Failed to delete Custom KPI.');
    }
  };

  // Save targets matrix spreadsheet cell modifications
  const handleSaveMatrixTargets = async () => {
    try {
      setSaving(true);
      setErrorMsg('');
      const targetsPayload = [];

      for (const cellKey of Object.keys(editedTargets)) {
        const [salespersonUid, kpiId] = cellKey.split('::');
        const sp = teamMembers.find(m => m.uid === salespersonUid);
        const kpi = kpis.find(k => k.id === kpiId);
        if (!sp || !kpi) continue;

        const targetValue = editedTargets[cellKey] || 0;
        targetsPayload.push({
          salespersonUid,
          salespersonName: sp.name || sp.email,
          kpiId,
          kpiName: kpi.name,
          targetValue
        });
      }

      const savedList = await performanceService.saveBulkTargets(user.organizationId, targetPeriod, targetsPayload);
      setTargets(prev => {
        const others = prev.filter(t => t.period !== targetPeriod);
        return [...others, ...savedList];
      });

      setSuccessMsg(`All Sales Targets for Period ${targetPeriod} saved successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save targets matrix.');
    } finally {
      setSaving(false);
    }
  };

  // Save achievements matrix spreadsheet cell modifications
  const handleSaveMatrixAchievements = async () => {
    try {
      setSaving(true);
      setErrorMsg('');
      const listToSave: { salespersonUid: string; salespersonName: string; kpiId: string; kpiName: string; value: number }[] = [];

      for (const cellKey of Object.keys(editedAchievements)) {
        const [salespersonUid, kpiId] = cellKey.split('::');
        const sp = teamMembers.find(m => m.uid === salespersonUid);
        const kpi = kpis.find(k => k.id === kpiId);
        if (!sp || !kpi) continue;

        const val = editedAchievements[cellKey] || 0;
        listToSave.push({
          salespersonUid,
          salespersonName: sp.name || sp.email,
          kpiId,
          kpiName: kpi.name,
          value: val
        });
      }

      const updatedList = await performanceService.saveBulkAchievements(user.organizationId, achPeriodMonth, listToSave);
      setAchievements(updatedList);

      setSuccessMsg(`All Sales Achievements for Month ${achPeriodMonth} saved successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save achievements matrix.');
    } finally {
      setSaving(false);
    }
  };

  // Export Achievements Matrix helper
  const handleExportAchievements = () => {
    try {
      const activeKpis = kpis.filter(k => k.active);
      const activeSalespeople = teamMembers.filter(m => m.role === 'Salesperson');
      
      const rows = activeSalespeople.map(sp => {
        const rowData: Record<string, any> = { 'Salesperson': sp.name || sp.email };
        activeKpis.forEach(k => {
          const val = editedAchievements[`${sp.uid}::${k.id}`] || 0;
          rowData[`${k.name} Achievement`] = val;
        });
        return rowData;
      });

      const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(rows, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonStr);
      downloadAnchor.setAttribute('download', `KRGONE_Achievement_Matrix_${achPeriodMonth}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      setErrorMsg('Failed to compile export document.');
    }
  };

  // Log a new manual override/achievement entry
  const handleLogAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    const { salespersonUid, kpiId, value, date, customerClient, product, supportingReference, notes } = logForm;
    if (!salespersonUid || !kpiId || value === '') {
      setErrorMsg('Please populate all required fields.');
      return;
    }

    const spObj = teamMembers.find(t => t.uid === salespersonUid);
    const kpiObj = kpis.find(k => k.id === kpiId);
    if (!spObj || !kpiObj) return;

    try {
      setSaving(true);
      setErrorMsg('');
      const created = await performanceService.addAchievement(
        user.organizationId,
        salespersonUid,
        spObj.name || spObj.email,
        kpiId,
        kpiObj.name,
        Number(value),
        date,
        customerClient,
        product,
        supportingReference,
        notes
      );

      setAchievements(prev => [...prev, created]);
      setLogForm({
        salespersonUid: user.role === 'Salesperson' ? user.uid : '',
        kpiId: '',
        value: '',
        date: new Date().toISOString().split('T')[0],
        customerClient: '',
        product: '',
        supportingReference: '',
        notes: ''
      });
      setShowAdvancedLog(false);
      setSuccessMsg('Achievement log submitted successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save achievement log.');
    } finally {
      setSaving(false);
    }
  };

  // Delete logged manual achievement
  const handleDeleteAchievement = async (id: string) => {
    if (!window.confirm('Retract this achievement? It will immediately alter current actuals and recalculate performance grades.')) return;
    try {
      setErrorMsg('');
      await performanceService.deleteAchievement(id);
      setAchievements(prev => prev.filter(a => a.id !== id));
      setSuccessMsg('Achievement retracted successfully.');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setErrorMsg('Failed to delete achievement log.');
    }
  };

  // Update manager feedback comment
  const handleSaveReviewComment = async (targetId: string) => {
    if (!targetId) return;
    try {
      setErrorMsg('');
      await performanceService.updateTargetComment(targetId, tempCommentText);
      setTargets(prev => prev.map(t => t.id === targetId ? { ...t, managerComment: tempCommentText } : t));
      setActiveCommentTargetId(null);
      setTempCommentText('');
      setSuccessMsg('Review note updated successfully.');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setErrorMsg('Failed to save review note.');
    }
  };

  // Save Visual Grade Threshold configurations
  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('krg_perf_ontrack_threshold', onTrackThreshold.toString());
    localStorage.setItem('krg_perf_attention_threshold', needsAttentionThreshold.toString());
    setSuccessMsg('Color grading threshold configurations saved successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Export Data Matrix helper
  const handleExportTargets = () => {
    try {
      const activeKpis = kpis.filter(k => k.active);
      const activeSalespeople = teamMembers.filter(m => m.role === 'Salesperson');
      
      const rows = activeSalespeople.map(sp => {
        const rowData: Record<string, any> = { 'Salesperson': sp.name || sp.email };
        activeKpis.forEach(k => {
          const val = editedTargets[`${sp.uid}::${k.id}`] || 0;
          rowData[`${k.name} Target`] = val;
        });
        return rowData;
      });

      const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(rows, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonStr);
      downloadAnchor.setAttribute('download', `KRGONE_Target_Matrix_${targetPeriod}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      setErrorMsg('Failed to compile export document.');
    }
  };

  // Export Reports helper
  const handleExportPerformanceReport = () => {
    try {
      const activeKpis = kpis.filter(k => k.active);
      const activeSalespeople = teamMembers.filter(m => m.role === 'Salesperson');

      const rows = activeSalespeople.flatMap(sp => {
        return activeKpis.map(k => {
          const m = calculatePeriodPerformance(sp.uid, k, dashboardMonth);
          return {
            'Period': dashboardMonth,
            'Salesperson': sp.name || sp.email,
            'KPI Objective': k.name,
            'Unit': k.unit,
            'Monthly Target': m.hasTarget ? m.target : 'No Target',
            'Actual Achieved': m.achievement,
            'Remaining Gap': m.hasTarget ? m.gap : '—',
            'Completion Rate': m.hasTarget ? `${m.achievementPercent}%` : '—',
            'Grading Status': m.status,
            'Review Feedback': m.managerComment || '—'
          };
        });
      });

      const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(rows, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonStr);
      downloadAnchor.setAttribute('download', `KRGONE_Performance_Report_${dashboardMonth}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      setErrorMsg('Failed to compile performance report.');
    }
  };

  // Filter KPI lists dynamically
  const filteredKpiList = kpis.filter(k => {
    const matchesSearch = k.name.toLowerCase().includes(kpiSearchText.toLowerCase());
    const matchesStatus = kpiStatusFilter === 'all' 
      ? true 
      : kpiStatusFilter === 'active' 
        ? k.active 
        : !k.active;
    return matchesSearch && matchesStatus;
  });

  // ====================================================
  // TEAM PERFORMANCE & ACCOUNTABILITY REDESIGN LOGIC
  // ====================================================
  const getOverallStatusStyle = (status: 'ON TRACK' | 'NEEDS ATTENTION' | 'BELOW TARGET') => {
    switch (status) {
      case 'ON TRACK':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          badge: 'ON TRACK'
        };
      case 'NEEDS ATTENTION':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-400',
          badge: 'NEEDS ATTENTION'
        };
      case 'BELOW TARGET':
      default:
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
          badge: 'BELOW TARGET'
        };
    }
  };

  const getReviewStatusStyle = (status: 'Open' | 'Monitoring' | 'Improved' | 'Closed') => {
    switch (status) {
      case 'Open':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
          label: 'OPEN'
        };
      case 'Monitoring':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-400',
          label: 'MONITORING'
        };
      case 'Improved':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'IMPROVED'
        };
      case 'Closed':
      default:
        return {
          bg: 'bg-slate-50 text-slate-705 border-slate-200',
          dot: 'bg-slate-500',
          label: 'CLOSED'
        };
    }
  };

  const reviewCounters = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Reviews in selected month
    const monthReviews = reviews.filter(r => r.reviewDate && r.reviewDate.substring(0, 7) === dashboardMonth);
    
    // 1. OPEN REVIEWS: reviews requiring manager action and not yet closed.
    const openReviews = monthReviews.filter(r => r.reviewStatus !== 'Closed');
    
    // 2. HIGH PRIORITY: salesperson/review requiring immediate corrective action, e.g. BELOW TARGET or marked High
    const highPriorityReviews = monthReviews.filter(r => (r.status === 'BELOW TARGET' || r.priority === 'High') && r.reviewStatus !== 'Closed');
    
    // 3. OVERDUE REVIEWS: next review date has passed and review is still open.
    const overdueReviews = monthReviews.filter(r => r.reviewStatus !== 'Closed' && r.nextReviewDate && r.nextReviewDate < todayStr);
    
    // 4. CLOSED: completed/closed review actions.
    const closedReviews = monthReviews.filter(r => r.reviewStatus === 'Closed');
    
    // 5. IMPROVED: salesperson whose current overall performance has improved compared with previous
    let improvedCount = 0;
    
    // Let's find improved count based on comparison
    const salespeople = teamMembers.filter(m => m.role === 'Salesperson');
    salespeople.forEach(sp => {
      const currentMonthReview = monthReviews.find(r => r.salespersonUid === sp.uid);
      if (!currentMonthReview) return;
      
      if (currentMonthReview.reviewStatus === 'Improved') {
        improvedCount++;
        return;
      }
      
      const allSpReviews = reviews.filter(r => r.salespersonUid === sp.uid);
      const sorted = [...allSpReviews].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
      const currentIndex = sorted.findIndex(r => r.id === currentMonthReview.id);
      if (currentIndex !== -1 && currentIndex < sorted.length - 1) {
        const prevReview = sorted[currentIndex + 1];
        const statusOrder = { 'BELOW TARGET': 0, 'NEEDS ATTENTION': 1, 'ON TRACK': 2 };
        const currentScore = statusOrder[currentMonthReview.status] || 0;
        const previousScore = statusOrder[prevReview.status] || 0;
        if (currentScore > previousScore) {
          improvedCount++;
        } else if ((currentMonthReview.completionPercentage || 0) > (prevReview.completionPercentage || 0)) {
          improvedCount++;
        }
      }
    });

    return {
      open: openReviews.length,
      highPriority: highPriorityReviews.length,
      overdue: overdueReviews.length,
      improved: improvedCount,
      closed: closedReviews.length
    };
  }, [reviews, dashboardMonth, teamMembers]);

  const salespeopleData = useMemo(() => {
    const salespeople = teamMembers.filter(m => m.role === 'Salesperson');
    
    return salespeople.map(sp => {
      const activeKpis = kpis.filter(k => k.active);
      
      const kpiMetrics = activeKpis.map(kpi => {
        const perf = calculatePeriodPerformance(sp.uid, kpi, dashboardMonth);
        
        // Calculate independent KPI status per Section 9
        let status: 'GREEN' | 'YELLOW' | 'RED' | 'NO_TARGET' = 'NO_TARGET';
        if (perf.hasTarget && perf.target > 0) {
          if (perf.achievementPercent >= 100) {
            status = 'GREEN';
          } else if (perf.achievementPercent >= 70) {
            status = 'YELLOW';
          } else {
            status = 'RED';
          }
        }
        
        return { 
          kpi, 
          perf: {
            ...perf,
            status
          } 
        };
      });

      const kpisWithTargets = kpiMetrics.filter(m => m.perf.hasTarget && m.perf.target > 0);
      const totalKpis = kpisWithTargets.length;
      const numOnTrack = kpiMetrics.filter(m => m.perf.status === 'GREEN').length;
      const numAttention = kpiMetrics.filter(m => m.perf.status === 'YELLOW').length;
      const numBelow = kpiMetrics.filter(m => m.perf.status === 'RED').length;

      // Calculate overallStatus based on majority (Section 9)
      let overallStatus: 'ON TRACK' | 'NEEDS ATTENTION' | 'BELOW TARGET' = 'NEEDS ATTENTION';
      if (totalKpis === 0) {
        overallStatus = 'ON TRACK';
      } else if (numOnTrack === totalKpis) {
        overallStatus = 'ON TRACK';
      } else if (numBelow > totalKpis / 2) {
        overallStatus = 'BELOW TARGET';
      } else {
        overallStatus = 'NEEDS ATTENTION';
      }

      const spReviews = reviews.filter(r => r.salespersonUid === sp.uid);
      const sortedSpReviews = [...spReviews].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate) || b.createdAt.localeCompare(a.createdAt));
      const latestReviewOverall = sortedSpReviews[0] || null;

      return {
        salesperson: sp,
        kpiMetrics,
        totalKpis,
        numOnTrack,
        numAttention,
        numBelow,
        overallStatus,
        latestReviewOverall
      };
    });
  }, [teamMembers, kpis, dashboardMonth, targets, achievements, reviews]);

  const filteredSalespeopleData = useMemo(() => {
    let result = salespeopleData;

    if (user.role === 'Salesperson') {
      result = result.filter(d => d.salesperson.uid === user.uid);
    } else {
      if (reviewFilterSalesperson !== 'all') {
        result = result.filter(d => d.salesperson.uid === reviewFilterSalesperson);
      }
    }

    if (reviewFilterStatus !== 'all') {
      result = result.filter(d => d.overallStatus === reviewFilterStatus);
    }

    if (reviewFilterKpi !== 'all') {
      result = result.map(d => {
        const filteredMetrics = d.kpiMetrics.filter(m => m.kpi.id === reviewFilterKpi);
        return {
          ...d,
          kpiMetrics: filteredMetrics
        };
      }).filter(d => d.kpiMetrics.length > 0);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (reviewQuickFilter === 'below_target') {
      result = result.filter(d => d.overallStatus === 'BELOW TARGET');
    } else if (reviewQuickFilter === 'needs_attention') {
      result = result.filter(d => d.overallStatus === 'NEEDS ATTENTION');
    } else if (reviewQuickFilter === 'on_track') {
      result = result.filter(d => d.overallStatus === 'ON TRACK');
    } else if (reviewQuickFilter === 'overdue') {
      result = result.filter(d => d.latestReviewOverall && d.latestReviewOverall.reviewStatus !== 'Closed' && d.latestReviewOverall.nextReviewDate < todayStr);
    } else if (reviewQuickFilter === 'no_review') {
      result = result.filter(d => {
        const hasReviewInMonth = reviews.some(r => r.salespersonUid === d.salesperson.uid && r.reviewDate && r.reviewDate.substring(0, 7) === dashboardMonth);
        return !hasReviewInMonth;
      });
    }

    return result;
  }, [salespeopleData, reviewFilterSalesperson, reviewFilterStatus, reviewFilterKpi, reviewQuickFilter, user, reviews, dashboardMonth]);

  const modalKpiPerformance = useMemo(() => {
    if (!selectedReviewSalesperson || !selectedReviewKpiId) return null;
    const kpi = kpis.find(k => k.id === selectedReviewKpiId);
    if (!kpi) return null;
    const perf = calculatePeriodPerformance(selectedReviewSalesperson.uid, kpi, dashboardMonth);
    return { kpi, perf };
  }, [selectedReviewSalesperson, selectedReviewKpiId, kpis, dashboardMonth, targets, achievements]);

  // Telecaller restricted notice
  if (user.role === 'Telecaller') {
    return (
      <div id="telecaller-access-restricted" className="bg-white border border-slate-200 rounded-2xl p-10 max-w-lg mx-auto text-center space-y-4 shadow-3xs my-12">
        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-500 shadow-3xs">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          KRGONE Sales Performance™ is configured for active Salespeople, Managers, and Owners. If you believe this is an error, please contact your workspace administrator to modify your credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Alerts Banner */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold flex items-start space-x-2 animate-fade-in shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold flex items-start space-x-2 animate-fade-in shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center space-y-4">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Synchronizing sales matrices with cloud baseline...</p>
        </div>
      ) : (
        <>
          {/* ====================================================
              SUB-TAB: PERFORMANCE DASHBOARD
              ==================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Salesperson Personal Portal View */}
              {false ? (
                <div className="space-y-6 animate-fade-in">
                  {/* Top Header Card */}
                  <div className="bg-gradient-to-r from-indigo-950 to-slate-950 p-6 rounded-2xl border border-indigo-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">My Salesperson Portal</span>
                      <h2 className="text-lg font-black tracking-tight text-white">My Performance & Goals Summary</h2>
                      <p className="text-[11px] text-slate-400 font-bold uppercase">
                        Real-time goals progression tracked dynamically for the active month.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800 p-1.5 rounded-xl">
                        <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase pl-1.5">Period:</span>
                        <input
                          type="month"
                          value={dashboardMonth}
                          onChange={(e) => setDashboardMonth(e.target.value)}
                          className="px-3 py-1 bg-slate-950 border border-slate-850 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Proportional trackers (Today vs Weekly pace overview) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                      <Clock className="w-4.5 h-4.5 text-indigo-600" />
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase">Proportional Trackers & Pace Velocity</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Calculated by breaking down monthly objectives proportionally across elapsed days</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {kpis.filter(k => k.active).map(kpi => {
                        const m = calculatePeriodPerformance(user.uid, kpi, dashboardMonth);
                        
                        // Monthly proportional pace
                        const [yearStr, monthStr] = dashboardMonth.split('-');
                        const yearNum = parseInt(yearStr, 10);
                        const monthNum = parseInt(monthStr, 10);
                        const totalDays = getDaysInMonth(yearNum, monthNum);
                        
                        const todayDate = new Date();
                        const currentYearMonth = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;
                        
                        let elapsedDays = totalDays;
                        if (dashboardMonth === currentYearMonth) {
                          elapsedDays = Math.max(1, todayDate.getDate());
                        } else if (dashboardMonth > currentYearMonth) {
                          elapsedDays = 1; 
                        }

                        const reqDaily = m.target / totalDays;
                        const actDaily = m.achievement / elapsedDays;
                        const isOnPace = actDaily >= reqDaily;

                        return (
                          <div key={kpi.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-slate-800">{kpi.name}</span>
                              <span className={`px-2 py-0.5 border text-[9px] font-black rounded-md ${
                                isOnPace ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}>
                                {isOnPace ? '🟢 ON PACE' : '🔴 BEHIND PACE'}
                              </span>
                            </div>

                            <div className="text-[11px] space-y-1 text-slate-500 font-bold">
                              <div className="flex justify-between">
                                <span>Elapsed Velocity:</span>
                                <span className="text-slate-800 font-black">{formatValue(Math.round(actDaily * 10) / 10, kpi.unit)}/day</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-200/55 pt-1">
                                <span>Required Velocity:</span>
                                <span className="text-slate-700 font-bold">{formatValue(Math.round(reqDaily * 10) / 10, kpi.unit)}/day</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual Primary KPI Progression Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {kpis.filter(k => k.active).map(kpi => {
                      const metrics = calculatePeriodPerformance(user.uid, kpi, dashboardMonth);
                      const badge = getStatusStyle(metrics.status);

                      return (
                        <div key={kpi.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-3xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-xs font-black text-slate-800">{kpi.name}</h4>
                                <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-black uppercase mt-1 inline-block">
                                  {kpi.unit}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 border text-[9px] font-black rounded-md uppercase tracking-wider ${badge.bg}`}>
                                {badge.label}
                              </span>
                            </div>

                            {/* Core numeric split values */}
                            <div className="grid grid-cols-3 gap-2 py-3 text-center border-y border-slate-100">
                              <div>
                                <span className="text-[9px] text-slate-400 block font-black uppercase">Goal Target</span>
                                <span className="text-xs font-black text-slate-800 mt-0.5 block">
                                  {metrics.hasTarget ? formatValue(metrics.target, kpi.unit) : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-black uppercase">Actuals</span>
                                <span className="text-xs font-black text-indigo-600 mt-0.5 block">
                                  {formatValue(metrics.achievement, kpi.unit)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-black uppercase">Remaining Gap</span>
                                <span className={`text-xs font-black mt-0.5 block ${metrics.gap <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {!metrics.hasTarget ? '—' : metrics.gap <= 0 ? '✓ Met' : formatValue(metrics.gap, kpi.unit)}
                                </span>
                              </div>
                            </div>

                            {/* Progression bar */}
                            {metrics.hasTarget && (
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-slate-500">Achievement Progression</span>
                                  <span className="text-indigo-600">{metrics.achievementPercent}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      metrics.achievementPercent >= onTrackThreshold 
                                        ? 'bg-emerald-500' 
                                        : metrics.achievementPercent >= needsAttentionThreshold 
                                          ? 'bg-amber-500' 
                                          : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.min(metrics.achievementPercent, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Manager Review Notes / Feedback Comments */}
                            {metrics.managerComment ? (
                              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mt-3 text-[11px] leading-relaxed">
                                <span className="font-black text-indigo-900 uppercase tracking-wider block mb-1">✍️ Manager Review Feedback Note:</span>
                                <p className="text-slate-700 italic font-semibold">"{metrics.managerComment}"</p>
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[10px] text-slate-400 italic text-center mt-3">
                                No review feedback logged for this target period.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (() => {
                const activeKpis = kpis.filter(k => k.active);
                const salespeople = teamMembers.filter(m => m.role === 'Salesperson');

                // 1. Calculate aggregated team performance for EACH active KPI
                const kpiAggregates = activeKpis.map(kpi => {
                  let teamTarget = 0;
                  let teamAchievement = 0;
                  let hasTarget = false;

                  salespeople.forEach(sp => {
                    const perf = calculatePeriodPerformance(sp.uid, kpi, dashboardMonth);
                    if (perf.hasTarget) {
                      teamTarget += perf.target;
                      hasTarget = true;
                    }
                    teamAchievement += perf.achievement;
                  });

                  const gap = teamTarget - teamAchievement;
                  const achievementPercent = teamTarget > 0 ? Math.round((teamAchievement / teamTarget) * 100) : 0;

                  // Color grading logic matching Section 6
                  let status: 'GREEN' | 'YELLOW' | 'RED' | 'NO_TARGET' = 'RED';
                  if (!hasTarget) {
                    status = 'NO_TARGET';
                  } else if (achievementPercent >= 100) {
                    status = 'GREEN';
                  } else if (achievementPercent >= 70) {
                    status = 'YELLOW';
                  } else {
                    status = 'RED';
                  }

                  return {
                    kpi,
                    teamTarget,
                    teamAchievement,
                    gap,
                    achievementPercent,
                    status,
                    hasTarget
                  };
                });

                // 2. Filter aggregated results if a specific KPI is selected
                const filteredKpiAggregates = dashboardKpiId === 'all'
                  ? kpiAggregates
                  : kpiAggregates.filter(item => item.kpi.id === dashboardKpiId);

                // 3. Compute top summary cards metrics based on filtered aggregates
                // If "All KPIs", we aggregate only Currency-type KPIs to avoid unit conflicts
                // If a specific KPI is selected, we aggregate using that KPI's unit!
                let displayUnit: 'Currency' | 'Number' | 'Percentage' = 'Currency';
                let targetSum = 0;
                let achievementSum = 0;
                let gapSum = 0;
                let activeKpisCount = 0;

                if (dashboardKpiId !== 'all') {
                  const selectedKpi = kpis.find(k => k.id === dashboardKpiId);
                  if (selectedKpi) {
                    displayUnit = selectedKpi.unit;
                    const agg = kpiAggregates.find(item => item.kpi.id === dashboardKpiId);
                    if (agg) {
                      targetSum = agg.teamTarget;
                      achievementSum = agg.teamAchievement;
                      gapSum = agg.gap;
                      activeKpisCount = agg.hasTarget ? 1 : 0;
                    }
                  }
                } else {
                  // All KPIs: Aggregate only Currency-type KPIs for financial totals
                  const currencyAggs = kpiAggregates.filter(item => item.kpi.unit === 'Currency');
                  currencyAggs.forEach(item => {
                    if (item.hasTarget) {
                      targetSum += item.teamTarget;
                      achievementSum += item.teamAchievement;
                      gapSum += item.gap;
                      activeKpisCount++;
                    } else {
                      achievementSum += item.teamAchievement;
                    }
                  });
                  displayUnit = 'Currency';
                }

                const overallPercent = targetSum > 0 ? Math.round((achievementSum / targetSum) * 100) : 0;

                // 4. Performance Distribution counts (Based on ALL active aggregated KPIs)
                let onTrackCount = 0;
                let needsAttentionCount = 0;
                let belowTargetCount = 0;

                kpiAggregates.forEach(item => {
                  if (item.hasTarget) {
                    if (item.status === 'GREEN') onTrackCount++;
                    else if (item.status === 'YELLOW') needsAttentionCount++;
                    else if (item.status === 'RED') belowTargetCount++;
                  }
                });

                const totalRatedKpis = onTrackCount + needsAttentionCount + belowTargetCount;
                const onTrackPct = totalRatedKpis > 0 ? Math.round((onTrackCount / totalRatedKpis) * 100) : 0;
                const needsAttentionPct = totalRatedKpis > 0 ? Math.round((needsAttentionCount / totalRatedKpis) * 100) : 0;
                const belowTargetPct = totalRatedKpis > 0 ? Math.round((belowTargetCount / totalRatedKpis) * 100) : 0;

                // Pie chart data
                const pieData = [
                  { name: 'On Track', value: onTrackCount, color: '#10b981', pct: onTrackPct },
                  { name: 'Needs Attention', value: needsAttentionCount, color: '#f59e0b', pct: needsAttentionPct },
                  { name: 'Below Target', value: belowTargetCount, color: '#ef4444', pct: belowTargetPct }
                ].filter(d => d.value > 0);

                // If empty, supply placeholder to prevent chart breaking
                const finalPieData = pieData.length > 0 ? pieData : [{ name: 'No Data', value: 1, color: '#cbd5e1', pct: 0 }];

                // 5. Chart data for double bar chart (Team Target vs Team Achievement)
                const chartData = kpiAggregates.map(item => ({
                  name: item.kpi.name.length > 15 ? item.kpi.name.substring(0, 12) + '...' : item.kpi.name,
                  fullName: item.kpi.name,
                  'Team Target': item.teamTarget,
                  'Team Achievement': item.teamAchievement,
                }));

                // 6. Top Insights dynamic compilation
                const insightsList: Array<{
                  id: string;
                  title: string;
                  desc: string;
                  type: 'success' | 'warning' | 'danger';
                }> = [];

                if (kpiAggregates.filter(item => item.hasTarget).length === 0) {
                  insightsList.push({
                    id: 'no-targets',
                    title: 'No KPI targets set.',
                    desc: 'Configure monthly salesperson goals in the Target Setting module.',
                    type: 'warning'
                  });
                } else {
                  // Insight A: Best performing KPI
                  const sortedByAchievement = [...kpiAggregates]
                    .filter(a => a.hasTarget)
                    .sort((a, b) => b.achievementPercent - a.achievementPercent);
                  
                  if (sortedByAchievement[0]) {
                    const item = sortedByAchievement[0];
                    const remaining = item.gap > 0 
                      ? `${formatValue(item.gap, item.kpi.unit)} more to achieve the target.` 
                      : 'Monthly target successfully achieved!';
                    insightsList.push({
                      id: 'best',
                      title: `${item.kpi.name} is at ${item.achievementPercent}% of target.`,
                      desc: remaining,
                      type: item.achievementPercent >= 100 ? 'success' : 'warning'
                    });
                  }

                  // Insight B: Needs Improvement (70% - 100%)
                  const needsImp = kpiAggregates.find(item => item.hasTarget && item.achievementPercent >= 70 && item.achievementPercent < 100);
                  if (needsImp) {
                    insightsList.push({
                      id: 'improvement',
                      title: `${needsImp.kpi.name} needs improvement.`,
                      desc: `${formatValue(needsImp.gap, needsImp.kpi.unit)} more to achieve the target.`,
                      type: 'warning'
                    });
                  } else {
                    // Second highest
                    const second = sortedByAchievement[1];
                    if (second) {
                      insightsList.push({
                        id: 'improvement',
                        title: `${second.kpi.name} has room for progress.`,
                        desc: `${formatValue(second.gap, second.kpi.unit)} remaining gap.`,
                        type: 'warning'
                      });
                    }
                  }

                  // Insight C: Below Target (< 70%)
                  const belowTar = kpiAggregates.find(item => item.hasTarget && item.achievementPercent < 70);
                  if (belowTar) {
                    insightsList.push({
                      id: 'below',
                      title: `${belowTar.kpi.name} is below target.`,
                      desc: `${formatValue(belowTar.gap, belowTar.kpi.unit)} more actuals required.`,
                      type: 'danger'
                    });
                  }

                  // Insight D: Rollup summary of low performing KPIs
                  const lowCount = kpiAggregates.filter(item => item.hasTarget && item.achievementPercent < 70).length;
                  const lowNames = kpiAggregates.filter(item => item.hasTarget && item.achievementPercent < 70).map(item => item.kpi.name).join(' and ');
                  if (lowCount > 0) {
                    insightsList.push({
                      id: 'rollup',
                      title: `${lowCount} KPI(s) are below 70% of target.`,
                      desc: `Focus on ${lowNames || 'recovering these categories'}.`,
                      type: 'danger'
                    });
                  } else {
                    insightsList.push({
                      id: 'rollup',
                      title: 'All active KPIs are performing strong!',
                      desc: 'Great alignment across the team metrics.',
                      type: 'success'
                    });
                  }
                }

                // Custom KPI Icon helper
                const getKpiIcon = (name: string) => {
                  const n = name.toLowerCase();
                  if (n.includes('revenue') || n.includes('sales') || n.includes('deal') || n.includes('profit')) {
                    return {
                      icon: <IndianRupee className="w-3.5 h-3.5" />,
                      colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-150',
                    };
                  }
                  if (n.includes('client onboarding') || n.includes('new client') || n.includes('onboarding') || n.includes('customer')) {
                    return {
                      icon: <Users className="w-3.5 h-3.5" />,
                      colorClass: 'bg-blue-50 text-blue-600 border-blue-150',
                    };
                  }
                  if (n.includes('meeting') || n.includes('call') || n.includes('activity')) {
                    return {
                      icon: <MessageSquare className="w-3.5 h-3.5" />,
                      colorClass: 'bg-indigo-50 text-indigo-600 border-indigo-150',
                    };
                  }
                  if (n.includes('product') || n.includes('item') || n.includes('unit')) {
                    return {
                      icon: <Box className="w-3.5 h-3.5" />,
                      colorClass: 'bg-amber-50 text-amber-600 border-amber-150',
                    };
                  }
                  if (n.includes('website') || n.includes('online') || n.includes('digital') || n.includes('web')) {
                    return {
                      icon: <Globe className="w-3.5 h-3.5" />,
                      colorClass: 'bg-teal-50 text-teal-600 border-teal-150',
                    };
                  }
                  return {
                    icon: <ActivityIcon className="w-3.5 h-3.5" />,
                    colorClass: 'bg-slate-50 text-slate-600 border-slate-150',
                  };
                };

                return (
                  <div className="space-y-6 animate-fade-in">
                    {/* 1. TOP TEAM DASHBOARD HEADER */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-5">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2.5">
                          <h2 className="text-xl font-black text-slate-900 tracking-tight">KRGONE Sales Performance™</h2>
                          <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 text-[9px] font-black uppercase rounded-lg tracking-wider">
                            OVERALL TEAM PERFORMANCE
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold">
                          Overall Team Target & Performance Management
                        </p>
                      </div>

                      {/* HEADER DROPDOWNS */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-4xs">
                          <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Month</span>
                          <input
                            type="month"
                            value={dashboardMonth}
                            onChange={(e) => setDashboardMonth(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-4xs">
                          <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">KPI Objective</span>
                          <select
                            value={dashboardKpiId}
                            onChange={(e) => setDashboardKpiId(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-4"
                          >
                            <option value="all">All KPIs</option>
                            {kpis.filter(k => k.active).map(kpi => (
                              <option key={kpi.id} value={kpi.id}>{kpi.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* 2. TOP TEAM SUMMARY CARDS (4 Columns) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {/* Card 1: Total Team Target */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-4xs flex items-center space-x-4">
                        <div className="p-3 bg-blue-55 text-blue-600 rounded-2xl border border-blue-100">
                          <Target className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">TOTAL TEAM TARGET</span>
                          <span className="block text-lg font-black text-slate-800 leading-tight">
                            {formatValue(targetSum, displayUnit)}
                          </span>
                          <span className="block text-[10px] text-slate-450 font-bold">
                            Across <strong className="text-slate-600">{activeKpisCount}</strong> KPI Objectives
                          </span>
                        </div>
                      </div>

                      {/* Card 2: Total Team Achievement */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-4xs flex items-center space-x-4">
                        <div className="p-3 bg-emerald-55/70 text-emerald-600 rounded-2xl border border-emerald-100">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">TOTAL TEAM ACHIEVEMENT</span>
                          <span className="block text-lg font-black text-emerald-600 leading-tight">
                            {formatValue(achievementSum, displayUnit)}
                          </span>
                          <span className="block text-[10px] text-slate-450 font-bold">
                            Across <strong className="text-emerald-700">{activeKpisCount}</strong> KPI Objectives
                          </span>
                        </div>
                      </div>

                      {/* Card 3: Total Remaining Gap */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-4xs flex items-center space-x-4">
                        <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl border border-amber-100">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">TOTAL REMAINING GAP</span>
                          <span className={`block text-lg font-black leading-tight ${gapSum <= 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {gapSum <= 0 ? '✓ Met' : formatValue(gapSum, displayUnit)}
                          </span>
                          <span className="block text-[10px] text-slate-450 font-bold">
                            Gap to achieve target
                          </span>
                        </div>
                      </div>

                      {/* Card 4: Overall Achievement */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-4xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">OVERALL ACHIEVEMENT</span>
                          <span className="text-xs font-black text-blue-600">{overallPercent}%</span>
                        </div>
                        <div className="space-y-1">
                          <span className="block text-lg font-black text-slate-800 leading-none">
                            {overallPercent}%
                          </span>
                          <span className="block text-[10px] text-slate-450 font-bold">
                            vs Total Target
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(overallPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. TEAM KPI PERFORMANCE TABLE */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-4xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center">
                          <Users className="w-4 h-4 text-indigo-600 mr-2" />
                          Team Performance by KPI Objective
                        </h4>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-y border-slate-150/80 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                              <th className="py-3 px-4">KPI Objective</th>
                              <th className="py-3 px-4 text-right">Team Target</th>
                              <th className="py-3 px-4 text-right">Team Achievement</th>
                              <th className="py-3 px-4 text-right">Remaining Gap</th>
                              <th className="py-3 px-4">Achievement %</th>
                              <th className="py-3 px-4 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                            {filteredKpiAggregates.length > 0 ? (
                              filteredKpiAggregates.map(item => {
                                const iconStyle = getKpiIcon(item.kpi.name);
                                
                                // Format remaining gap properly with sign
                                let gapText = '';
                                let gapColor = 'text-rose-600';
                                if (!item.hasTarget) {
                                  gapText = '—';
                                  gapColor = 'text-slate-400 font-bold';
                                } else if (item.gap <= 0) {
                                  gapText = `+${formatValue(Math.abs(item.gap), item.kpi.unit)}`;
                                  gapColor = 'text-emerald-600 font-black';
                                } else {
                                  gapText = formatValue(item.gap, item.kpi.unit);
                                  gapColor = 'text-rose-600 font-black';
                                }

                                // Progress bar color based on status
                                const progressColor = item.status === 'GREEN' 
                                  ? 'bg-emerald-500' 
                                  : item.status === 'YELLOW' 
                                    ? 'bg-amber-500' 
                                    : 'bg-rose-500';

                                // Pill status style matching Section 6
                                const pillStyle = item.status === 'GREEN'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : item.status === 'YELLOW'
                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : item.status === 'NO_TARGET'
                                      ? 'bg-slate-50 border-slate-200 text-slate-555'
                                      : 'bg-rose-50 border-rose-200 text-rose-800';

                                const pillDot = item.status === 'GREEN'
                                  ? 'bg-emerald-500'
                                  : item.status === 'YELLOW'
                                    ? 'bg-amber-500'
                                    : item.status === 'NO_TARGET'
                                      ? 'bg-slate-400'
                                      : 'bg-rose-500';

                                const pillLabel = item.status === 'GREEN'
                                  ? 'ON TRACK'
                                  : item.status === 'YELLOW'
                                    ? 'NEEDS ATTENTION'
                                    : item.status === 'NO_TARGET'
                                      ? 'NO TARGET ASSIGNED'
                                      : 'BELOW TARGET';

                                return (
                                  <tr key={item.kpi.id} className="hover:bg-slate-50/40 transition-colors">
                                    {/* KPI Name and Icon */}
                                    <td className="py-4 px-4 font-extrabold text-slate-800">
                                      <div className="flex items-center space-x-3">
                                        <div className={`p-2 rounded-xl border ${iconStyle.colorClass}`}>
                                          {iconStyle.icon}
                                        </div>
                                        <span className="text-[12px]">{item.kpi.name}</span>
                                      </div>
                                    </td>

                                    {/* Team Target */}
                                    <td className="py-4 px-4 text-right font-bold text-slate-700 text-[12px]">
                                      {item.hasTarget ? (
                                        formatValue(item.teamTarget, item.kpi.unit)
                                      ) : (
                                        <span className="text-slate-400 font-bold uppercase text-[9px]">No Target</span>
                                      )}
                                    </td>

                                    {/* Team Achievement */}
                                    <td className="py-4 px-4 text-right font-black text-[12px] text-emerald-600">
                                      {formatValue(item.teamAchievement, item.kpi.unit)}
                                    </td>

                                    {/* Remaining Gap */}
                                    <td className={`py-4 px-4 text-right text-[12px] ${gapColor}`}>
                                      {gapText}
                                    </td>

                                    {/* Progress bar & percentage */}
                                    <td className="py-4 px-4 text-[12px]">
                                      {item.hasTarget ? (
                                        <div className="flex items-center space-x-3 w-40">
                                          <span className="font-extrabold text-slate-800 w-8">{item.achievementPercent}%</span>
                                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                                            <div 
                                              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                                              style={{ width: `${Math.min(item.achievementPercent, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 font-bold">—</span>
                                      )}
                                    </td>

                                    {/* Status Pill */}
                                    <td className="py-4 px-4 text-center">
                                      <span className={`inline-flex items-center px-2.5 py-1 text-[9px] font-black tracking-wider uppercase border rounded-lg ${pillStyle}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${pillDot}`}></span>
                                        {pillLabel}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={6} className="text-center py-10 text-slate-400 italic">
                                  No active KPI objective records found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center space-x-2 bg-indigo-50/50 border border-indigo-100/60 rounded-xl p-3 text-[11px] text-indigo-700">
                        <HelpCircle className="w-4 h-4 text-indigo-500" />
                        <span>All values are aggregated across the team for the selected month.</span>
                      </div>
                    </div>

                    {/* 4. BOTTOM BENTO GRID SECTION (Distribution, Chart, Insights) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Column A: Performance Distribution (3/12 width) */}
                      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-4xs flex flex-col justify-between space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Performance Distribution</h4>
                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Rating split of goals</p>
                        </div>

                        {/* Circular Chart Wrapper */}
                        <div className="h-44 w-full flex items-center justify-center relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={finalPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={pieData.length > 1 ? 4 : 0}
                                dataKey="value"
                              >
                                {finalPieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          
                          {/* Center Stats overlay */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xl font-black text-slate-800 leading-none">{onTrackPct}%</span>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-1">On Track</span>
                          </div>
                        </div>

                        {/* Chart Legend list */}
                        <div className="space-y-2 text-[11px] font-bold text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                              On Track
                            </span>
                            <span className="text-slate-800 font-black">{onTrackCount} KPIs ({onTrackPct}%)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center">
                              <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                              Needs Attention
                            </span>
                            <span className="text-slate-800 font-black">{needsAttentionCount} KPIs ({needsAttentionPct}%)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center">
                              <span className="w-2 h-2 bg-rose-500 rounded-full mr-2"></span>
                              Below Target
                            </span>
                            <span className="text-slate-800 font-black">{belowTargetCount} KPIs ({belowTargetPct}%)</span>
                          </div>
                        </div>

                        {/* Total KPIs card footnote */}
                        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-center">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Total KPI Objectives</span>
                          <span className="text-xs font-black text-slate-700 mt-0.5 block">{totalRatedKpis}</span>
                        </div>
                      </div>

                      {/* Column B: Team Achievement vs Target by KPI (6/12 width) */}
                      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-4xs flex flex-col justify-between space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Team Achievement vs Target by KPI</h4>
                            <p className="text-[10px] text-slate-400 uppercase mt-0.5">Manager target actual comparison</p>
                          </div>
                          
                          {/* Interactive Legend block */}
                          <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-wider text-slate-450">
                            <div className="flex items-center">
                              <span className="w-2.5 h-2.5 bg-blue-500 rounded-xs mr-1.5"></span>
                              Team Target
                            </div>
                            <div className="flex items-center">
                              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs mr-1.5"></span>
                              Team Achievement
                            </div>
                          </div>
                        </div>

                        {/* Visual BarChart Graph */}
                        <div className="h-48 w-full">
                          {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight={750} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="Team Target" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={12} />
                                <Bar dataKey="Team Achievement" fill="#10b981" radius={[3, 3, 0, 0]} barSize={12} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-xs font-bold">
                              No performance targets logged to display analytical visuals.
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-150 rounded-xl p-3 text-[11px] text-slate-500">
                          <HelpCircle className="w-4 h-4 text-slate-400" />
                          <span>Targets and achievements are aggregated across the team.</span>
                        </div>
                      </div>

                      {/* Column C: Top Insights (3/12 width) */}
                      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-4xs flex flex-col justify-between space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Top Insights</h4>
                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">AI dynamic highlights</p>
                        </div>

                        {/* Insight items container */}
                        <div className="space-y-3.5 flex-1 py-1 overflow-y-auto max-h-[220px]">
                          {insightsList.map((ins, index) => {
                            const styleClass = ins.type === 'success'
                              ? { bg: 'bg-emerald-50/70 border border-emerald-100', text: 'text-emerald-800', desc: 'text-slate-500', icon: <TrendingUp className="w-4 h-4 text-emerald-500" /> }
                              : ins.type === 'danger'
                                ? { bg: 'bg-rose-50/70 border border-rose-100', text: 'text-rose-800', desc: 'text-slate-500', icon: <AlertCircle className="w-4 h-4 text-rose-500" /> }
                                : { bg: 'bg-amber-50/70 border border-amber-100', text: 'text-amber-800', desc: 'text-slate-500', icon: <AlertCircle className="w-4 h-4 text-amber-500" /> };

                            return (
                              <div key={ins.id} className={`p-3 rounded-xl flex items-start space-x-3 shadow-4xs ${styleClass.bg}`}>
                                <div className="shrink-0 mt-0.5">
                                  {styleClass.icon}
                                </div>
                                <div className="space-y-0.5">
                                  <span className={`block text-[11px] font-black leading-tight ${styleClass.text}`}>
                                    {ins.title}
                                  </span>
                                  <span className={`block text-[10px] font-bold ${styleClass.desc}`}>
                                    {ins.desc}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* 5. INFORMATIONAL HINT BAR FOOTER */}
                    <div className="flex items-center space-x-2.5 bg-indigo-50 border border-indigo-100/80 rounded-2xl p-4 text-[11px] text-indigo-850 shadow-4xs">
                      <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                      <span>
                        Sales Performance Dashboard provides overall team performance summary. For individual performance review and action, please use <strong>Team Review</strong>.
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ====================================================
              SUB-TAB: KPI & TARGET SETTING (Owner/Manager Only)
              ==================================================== */}
          {activeTab === 'target-setting' && user.role !== 'Salesperson' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              {/* Left Column: KPI Objective Library */}
              <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                    <List className="w-4 h-4 text-indigo-600 mr-1.5" />
                    KPI Objectives Library
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Configure default baseline metrics and create custom organization KPIs.</p>
                </div>

                {/* Search & Filters */}
                <div className="space-y-3 pt-1 border-t border-slate-100">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search KPI objectives..."
                      value={kpiSearchText}
                      onChange={(e) => setKpiSearchText(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {(['all', 'active', 'inactive'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setKpiStatusFilter(f)}
                        className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md tracking-wider border transition-all ${
                          kpiStatusFilter === f 
                            ? 'bg-slate-900 text-white border-slate-900' 
                            : 'bg-slate-55 border-slate-200 text-slate-550 hover:bg-slate-100'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Create Custom KPI Form */}
                <form onSubmit={handleCreateKpi} className="bg-slate-50 border border-slate-200/85 p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-black text-indigo-700 tracking-wider uppercase block">✨ Create Custom Objective KPI</span>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">KPI Objective Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cross-Selling Contracts"
                      value={newKpiName}
                      onChange={(e) => setNewKpiName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Units Format</label>
                    <select
                      value={newKpiUnit}
                      onChange={(e) => setNewKpiUnit(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Currency">Currency (₹ Lakhs/Count)</option>
                      <option value="Number">Absolute Number Count</option>
                      <option value="Percentage">Percentage Goal (%)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-xs flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{saving ? 'Creating...' : 'Add KPI to Library'}</span>
                  </button>
                </form>

                {/* KPIs Listing */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {filteredKpiList.map(kpi => (
                    <div key={kpi.id} className="bg-white border border-slate-150 p-3 rounded-lg flex items-center justify-between shadow-4xs">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black text-slate-800">{kpi.name}</span>
                          <span className={`text-[8px] font-extrabold px-1.5 rounded-sm border ${
                            kpi.kpiType === 'system' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}>
                            {kpi.kpiType === 'system' ? 'SYSTEM' : 'CUSTOM'}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block mt-1">Format: {kpi.unit}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleToggleKpi(kpi.id, kpi.active)}
                          className={`px-2 py-0.5 rounded-md text-[8px] font-black border transition-colors ${
                            kpi.active 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {kpi.active ? 'ACTIVE' : 'MUTED'}
                        </button>

                        {kpi.kpiType !== 'system' && (
                          <button
                            onClick={() => handleDeleteKpi(kpi.id)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-colors"
                            title="Delete Custom KPI"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredKpiList.length === 0 && (
                    <p className="text-center text-[11px] text-slate-400 py-4 italic font-bold">No matching KPI objectives in database.</p>
                  )}
                </div>
              </div>

              {/* Right Column: Spreadsheet-like Target Settings Matrix */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                      <Target className="w-4 h-4 text-indigo-600 mr-1.5" />
                      Monthly Goal Allocation Matrix
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Configure individual salesperson targets across active KPI objectives.</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="month"
                      value={targetPeriod}
                      onChange={(e) => setTargetPeriod(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />

                  </div>
                </div>

                {/* Matrix spreadsheet cells */}
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-xs table-fixed min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[9px] tracking-wider">
                        <th className="py-3 px-4 w-[160px] border-r border-slate-200">Salesperson</th>
                        {kpis.filter(k => k.active).map(kpi => (
                          <th key={kpi.id} className="py-3 px-4 text-center border-r border-slate-200">
                            <span className="block truncate">{kpi.name}</span>
                            <span className="text-[8px] text-indigo-500 block">({kpi.unit})</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teamMembers.filter(m => m.role === 'Salesperson').map(sp => (
                        <tr key={sp.uid} className="hover:bg-slate-50/40">
                          <td className="py-3 px-4 font-black text-slate-900 border-r border-slate-200 truncate">
                            {sp.name || sp.email}
                          </td>
                          {kpis.filter(k => k.active).map(kpi => {
                            const key = `${sp.uid}::${kpi.id}`;
                            const val = editedTargets[key] !== undefined ? editedTargets[key] : '';
                            return (
                              <td key={kpi.id} className="p-2 border-r border-slate-200">
                                <input
                                  type="number"
                                  min="0"
                                  className="w-full text-center px-2 py-1 border border-slate-200/70 rounded-lg text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  placeholder="0"
                                  value={val}
                                  onChange={(e) => {
                                    const rawVal = e.target.value;
                                    setEditedTargets(prev => ({
                                      ...prev,
                                      [key]: rawVal === '' ? 0 : Number(rawVal)
                                    }));
                                  }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {teamMembers.filter(m => m.role === 'Salesperson').length === 0 && (
                        <tr>
                          <td colSpan={kpis.filter(k => k.active).length + 1} className="text-center py-8 text-slate-400 font-bold italic">
                            No active Salespeople users registered in organization.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase">⚠️ Matrix changes require a complete save action below.</span>
                  <button
                    onClick={handleSaveMatrixTargets}
                    disabled={saving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving Goals...' : 'Save All Matrix Goals'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              SUB-TAB: ACHIEVEMENT ENTRY
              ==================================================== */}
          {activeTab === 'achievement-entry' && (
            <div className="space-y-6 animate-fade-in">
              {/* Mode Selector Toggle Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-4xs">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                    <Award className="w-4 h-4 text-indigo-600 mr-1.5" />
                    Manual Achievement & Actuals Entry
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    Log and update metric actual accomplishments directly in the organization register.
                  </p>
                </div>

                <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setAchMatrixMode('matrix')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
                      achMatrixMode === 'matrix'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                    <span>Spreadsheet Matrix</span>
                  </button>
                  <button
                    onClick={() => setAchMatrixMode('single')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
                      achMatrixMode === 'single'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Single Log Form</span>
                  </button>
                </div>
              </div>

              {achMatrixMode === 'matrix' ? (
                /* Matrix spreadsheet-like view for Achievements */
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                        <Award className="w-4 h-4 text-indigo-600 mr-1.5" />
                        Monthly Actuals Spreadsheet Matrix
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                        {user.role === 'Salesperson'
                          ? 'Enter and submit your individual actual values for active KPI objectives.'
                          : 'Enter and submit salesperson actual values for active KPI objectives in bulk.'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="month"
                        value={achPeriodMonth}
                        onChange={(e) => setAchPeriodMonth(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-150 rounded-xl">
                    <table className="w-full text-left text-xs table-fixed min-w-[650px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[9px] tracking-wider">
                          <th className="py-3 px-4 w-[160px] border-r border-slate-200">Salesperson</th>
                          {kpis.filter(k => k.active).map(kpi => (
                            <th key={kpi.id} className="py-3 px-4 text-center border-r border-slate-200">
                              <span className="block truncate">{kpi.name}</span>
                              <span className="text-[8px] text-indigo-500 block">({kpi.unit})</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {teamMembers
                          .filter(m => m.role === 'Salesperson')
                          .filter(sp => user.role === 'Salesperson' ? sp.uid === user.uid : true)
                          .map(sp => (
                            <tr key={sp.uid} className="hover:bg-slate-50/40">
                              <td className="py-3 px-4 font-black text-slate-900 border-r border-slate-200 truncate">
                                {sp.name || sp.email}
                              </td>
                              {kpis.filter(k => k.active).map(kpi => {
                                const key = `${sp.uid}::${kpi.id}`;
                                const val = editedAchievements[key] !== undefined ? editedAchievements[key] : '';
                                return (
                                  <td key={kpi.id} className="p-2 border-r border-slate-200">
                                    <input
                                      type="number"
                                      min="0"
                                      className="w-full text-center px-2 py-1 border border-slate-200/70 rounded-lg text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      placeholder="0"
                                      value={val}
                                      onChange={(e) => {
                                        const rawVal = e.target.value;
                                        setEditedAchievements(prev => ({
                                          ...prev,
                                          [key]: rawVal === '' ? 0 : Number(rawVal)
                                        }));
                                      }}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        {teamMembers.filter(m => m.role === 'Salesperson').length === 0 && (
                          <tr>
                            <td colSpan={kpis.filter(k => k.active).length + 1} className="text-center py-8 text-slate-400 font-bold italic">
                              No active Salespeople users registered in organization.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      ⚠️ Saving will consolidate and override existing manual achievements for {achPeriodMonth}.
                    </span>
                    <button
                      onClick={handleSaveMatrixAchievements}
                      disabled={saving}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-1.5"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Saving Accomplishments...' : 'Save All Matrix Achievements'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Original Single Item Log Form */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Log Form */}
                  <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                        <Award className="w-4 h-4 text-indigo-600 mr-1.5" />
                        Log Single Achievement
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                        Log advanced manual entry logs with clients and notes.
                      </p>
                    </div>

                    <form onSubmit={handleLogAchievement} className="space-y-4 pt-1 border-t border-slate-100">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Salesperson Register</label>
                        {user.role === 'Salesperson' ? (
                          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800">
                            {user.name || user.email}
                          </div>
                        ) : (
                          <select
                            required
                            value={logForm.salespersonUid}
                            onChange={(e) => setLogForm({ ...logForm, salespersonUid: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">-- Select Salesperson --</option>
                            {teamMembers.filter(m => m.role === 'Salesperson').map((sp) => (
                              <option key={sp.uid} value={sp.uid}>{sp.name || sp.email}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">KPI Objective Target</label>
                        <select
                          required
                          value={logForm.kpiId}
                          onChange={(e) => setLogForm({ ...logForm, kpiId: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">-- Choose Objective KPI --</option>
                          {kpis.filter(k => k.active).map((kpi) => (
                            <option key={kpi.id} value={kpi.id}>{kpi.name} ({kpi.unit})</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Completed Value</label>
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="e.g. 50"
                            value={logForm.value}
                            onChange={(e) => setLogForm({ ...logForm, value: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Completion Date</label>
                          <input
                            type="date"
                            required
                            value={logForm.date}
                            onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Optional Advanced Expandable Segment */}
                      <div className="border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedLog(!showAdvancedLog)}
                          className="text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center hover:text-indigo-800"
                        >
                          <span>{showAdvancedLog ? '✕ Hide' : '➕ Show'} Advanced Meta Fields</span>
                        </button>

                        {showAdvancedLog && (
                          <div className="space-y-3 mt-3 animate-fade-in">
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Customer / Client Name</label>
                              <input
                                type="text"
                                placeholder="e.g. Acme Corp Inc."
                                value={logForm.customerClient}
                                onChange={(e) => setLogForm({ ...logForm, customerClient: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Product / Contract Package</label>
                              <input
                                type="text"
                                placeholder="e.g. Cloud Security Suite"
                                value={logForm.product}
                                onChange={(e) => setLogForm({ ...logForm, product: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Supporting Reference Code</label>
                              <input
                                type="text"
                                placeholder="e.g. CONT-2026-X9"
                                value={logForm.supportingReference}
                                onChange={(e) => setLogForm({ ...logForm, supportingReference: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Log Description Notes</label>
                              <textarea
                                rows={2}
                                placeholder="e.g. Project onboarding finalized with CEO signature."
                                value={logForm.notes}
                                onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-1.5"
                      >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Logging Entries...' : 'Submit Achievement Entry'}</span>
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Recent Achievements List */}
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                        <Clock className="w-4 h-4 text-indigo-600 mr-1.5" />
                        Recent Achievements Register Logs
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Scrollable chronology list of manually entered performance accomplishments.</p>
                    </div>

                    <div className="overflow-x-auto border border-slate-150 rounded-xl max-h-[440px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[9px] tracking-wider sticky top-0">
                            <th className="py-3 px-4">Salesperson</th>
                            <th className="py-3 px-4">KPI Objective</th>
                            <th className="py-3 px-4">Value</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Verification Metadata</th>
                            <th className="py-3 px-4 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {achievements
                            .filter(a => user.role === 'Salesperson' ? a.salespersonUid === user.uid : true)
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map(item => (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-black text-slate-900">{item.salespersonName}</td>
                                <td className="py-3 px-4 font-bold text-slate-650">{item.kpiName}</td>
                                <td className="py-3 px-4 font-extrabold text-indigo-600">{item.value}</td>
                                <td className="py-3 px-4 font-bold text-slate-500">{item.date}</td>
                                <td className="py-3 px-4 text-[10px] text-slate-400 space-y-0.5 max-w-[180px] truncate">
                                  {item.customerClient && (
                                    <span className="block truncate font-bold">🏢 Client: {item.customerClient}</span>
                                  )}
                                  {item.product && (
                                    <span className="block truncate font-bold">📦 Product: {item.product}</span>
                                  )}
                                  {item.supportingReference && (
                                    <span className="block truncate font-bold">📄 Ref: {item.supportingReference}</span>
                                  )}
                                  {item.notes && (
                                    <span className="block truncate italic">"{item.notes}"</span>
                                  )}
                                  {!item.customerClient && !item.product && !item.supportingReference && !item.notes && (
                                    <span className="text-slate-300 italic">No advanced metadata</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => handleDeleteAchievement(item.id)}
                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Retract achievement"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          {achievements.filter(a => user.role === 'Salesperson' ? a.salespersonUid === user.uid : true).length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-10 text-slate-400 font-bold italic">
                                No manual accomplishments logged in database.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====================================================
              SUB-TAB: TEAM REVIEW & GAP ANALYSIS
              ==================================================== */}
          {activeTab === 'team-review' && (
            <div className="space-y-6 animate-fade-in" id="team-review-panel">
              {/* Top Title Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      {user.role === 'Salesperson' ? 'My Accountability & Interventions' : 'Team Review & Gap Analysis'}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-indigo-200">
                      {user.role === 'Salesperson' ? 'Personal Interventions' : 'Accountability & Action'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-1">
                    {user.role === 'Salesperson' 
                      ? 'Track your performance goals, gaps, and manager corrective action plans.' 
                      : 'Identify performance gaps, take action, and track progress.'}
                  </p>
                </div>
                
                {/* Month Picker */}
                <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-3xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Month:</span>
                  <input
                    type="month"
                    value={dashboardMonth}
                    onChange={(e) => setDashboardMonth(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {user.role !== 'Salesperson' && (
                <>
                  {/* Minimal Review Counters Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Card 1: Open Reviews */}
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-3xs flex items-start space-x-3.5" id="counter-open-reviews">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Open Reviews</span>
                        <span className="text-2xl font-black text-slate-900 leading-tight block mt-0.5">{reviewCounters.open}</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Needs attention</span>
                      </div>
                    </div>

                    {/* Card 2: High Priority */}
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-3xs flex items-start space-x-3.5" id="counter-high-priority">
                      <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">High Priority</span>
                        <span className="text-2xl font-black text-slate-900 leading-tight block mt-0.5">{reviewCounters.highPriority}</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Require immediate action</span>
                      </div>
                    </div>

                    {/* Card 3: Overdue Reviews */}
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-3xs flex items-start space-x-3.5" id="counter-overdue-reviews">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overdue Reviews</span>
                        <span className="text-2xl font-black text-slate-900 leading-tight block mt-0.5">{reviewCounters.overdue}</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Past review date</span>
                      </div>
                    </div>

                    {/* Card 4: Improved */}
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-3xs flex items-start space-x-3.5" id="counter-improved">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Improved</span>
                        <span className="text-2xl font-black text-slate-900 leading-tight block mt-0.5">{reviewCounters.improved}</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Showing progress</span>
                      </div>
                    </div>

                    {/* Card 5: Closed */}
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-3xs flex items-start space-x-3.5" id="counter-closed">
                      <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Closed</span>
                        <span className="text-2xl font-black text-slate-900 leading-tight block mt-0.5">{reviewCounters.closed}</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Actions completed</span>
                      </div>
                    </div>
                  </div>

                  {/* Filters Panel */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Select Dropdowns */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-3xl">
                        {/* Salesperson Dropdown */}
                        <div className="space-y-1">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Salesperson</label>
                          <select
                            value={reviewFilterSalesperson}
                            onChange={(e) => setReviewFilterSalesperson(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                          >
                            <option value="all">All Salespeople</option>
                            {teamMembers.filter(m => m.role === 'Salesperson').map(sp => (
                              <option key={sp.uid} value={sp.uid}>{sp.name || sp.email}</option>
                            ))}
                          </select>
                        </div>

                        {/* Status Dropdown */}
                        <div className="space-y-1">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Status</label>
                          <select
                            value={reviewFilterStatus}
                            onChange={(e) => setReviewFilterStatus(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                          >
                            <option value="all">All Statuses</option>
                            <option value="ON TRACK">On Track</option>
                            <option value="NEEDS ATTENTION">Needs Attention</option>
                            <option value="BELOW TARGET">Below Target</option>
                          </select>
                        </div>

                        {/* KPI Dropdown */}
                        <div className="space-y-1">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">KPI</label>
                          <select
                            value={reviewFilterKpi}
                            onChange={(e) => setReviewFilterKpi(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                          >
                            <option value="all">All KPIs</option>
                            {kpis.filter(k => k.active).map(kpi => (
                              <option key={kpi.id} value={kpi.id}>{kpi.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Quick Filters pills */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Quick Filters:</span>
                        
                        <button
                          onClick={() => setReviewQuickFilter('all')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            reviewQuickFilter === 'all'
                              ? 'bg-indigo-650 border-indigo-600 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          All
                        </button>
                        
                        <button
                          onClick={() => setReviewQuickFilter('below_target')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            reviewQuickFilter === 'below_target'
                              ? 'bg-rose-655 border-rose-600 text-white shadow-xs'
                              : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/70'
                          }`}
                        >
                          🔴 Below Target
                        </button>

                        <button
                          onClick={() => setReviewQuickFilter('needs_attention')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            reviewQuickFilter === 'needs_attention'
                              ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70'
                          }`}
                        >
                          🟡 Needs Attention
                        </button>

                        <button
                          onClick={() => setReviewQuickFilter('on_track')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            reviewQuickFilter === 'on_track'
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
                          }`}
                        >
                          🟢 On Track
                        </button>

                        <button
                          onClick={() => setReviewQuickFilter('overdue')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            reviewQuickFilter === 'overdue'
                              ? 'bg-indigo-900 border-indigo-900 text-white shadow-xs'
                              : 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100/70'
                          }`}
                        >
                          Overdue Reviews
                        </button>

                        <button
                          onClick={() => setReviewQuickFilter('no_review')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            reviewQuickFilter === 'no_review'
                              ? 'bg-slate-600 border-slate-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                          }`}
                        >
                          ⚪ No Review
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-6">
                {filteredSalespeopleData.length > 0 ? (
                  filteredSalespeopleData.map((spData) => {
                    const statusStyle = getOverallStatusStyle(spData.overallStatus);
                    const latestRev = spData.latestReviewOverall;
                    const revStatusStyle = latestRev ? getReviewStatusStyle(latestRev.reviewStatus) : null;

                    return (
                      <div 
                        key={spData.salesperson.uid} 
                        className="bg-white border border-slate-200 rounded-2xl shadow-3xs hover:shadow-xs transition-all duration-350 overflow-hidden flex flex-col group"
                        id={`review-card-${spData.salesperson.uid}`}
                      >
                        {/* 1. COLLAPSIBLE PROFILE HEADER (Full Width) */}
                        {(() => {
                          const isExpanded = expandedCards[spData.salesperson.uid] !== false;
                          return (
                            <>
                              <div 
                                className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-all select-none border-b border-slate-100"
                                onClick={() => setExpandedCards(prev => ({ ...prev, [spData.salesperson.uid]: !isExpanded }))}
                              >
                                <div className="flex items-center space-x-3.5">
                                  {/* Avatar */}
                                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-extrabold text-sm tracking-wide transition-all group-hover:from-indigo-50 group-hover:to-indigo-100 group-hover:border-indigo-200 group-hover:text-indigo-700 shadow-4xs">
                                    {spData.salesperson.name ? spData.salesperson.name.substring(0, 2).toUpperCase() : 'SP'}
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2 tracking-tight">
                                      <span>{spData.salesperson.name || spData.salesperson.email}</span>
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-bold">
                                      <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md font-extrabold border border-slate-150 uppercase text-[9px]">{spData.totalKpis} KPIs Assigned</span>
                                      <span>•</span>
                                      <span className="text-emerald-600 font-extrabold">{spData.numOnTrack} Met</span>
                                      <span>•</span>
                                      <span className="text-amber-500 font-extrabold">{spData.numAttention} Attention</span>
                                      <span>•</span>
                                      <span className="text-rose-500 font-extrabold">{spData.numBelow} Below</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                  <span className={`inline-flex items-center px-2.5 py-1 text-[10px] border font-black rounded-lg tracking-wide ${statusStyle.bg}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} mr-1.5`}></span>
                                    {statusStyle.badge}
                                  </span>
                                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </div>

                              {/* 2. CARD CONTENT (Only rendered when isExpanded) */}
                              {isExpanded && (
                                <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-150">
                                  {/* LEFT SIDE: KPI Objectives Bento (72%) */}
                                  <div className="p-5 lg:w-[72%] space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                      <div className="space-y-0.5">
                                        <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Metrics Snapshot & Gaps</h5>
                                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Current Period: {dashboardMonth}</p>
                                      </div>
                                      <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md font-bold uppercase">
                                        Performance Board View
                                      </span>
                                    </div>

                                    {/* Bento Grid layout of KPIs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {spData.kpiMetrics.map(({ kpi, perf }) => {
                                        const badge = getStatusStyle(perf.status);
                                        return (
                                          <div 
                                            key={kpi.id} 
                                            className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all duration-200 group/kpi"
                                          >
                                            <div className="space-y-2.5">
                                              {/* KPI Title & Badge */}
                                              <div className="flex items-start justify-between">
                                                <div className="space-y-0.5">
                                                  <span className="font-extrabold text-slate-900 text-xs tracking-tight block">
                                                    {kpi.name}
                                                  </span>
                                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                                                    Unit: {kpi.unit}
                                                  </span>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-0.5 border text-[9px] font-black rounded-md ${badge.bg}`}>
                                                  {badge.label}
                                                </span>
                                              </div>

                                              {/* Values Block */}
                                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                                <div>
                                                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                                                    Target
                                                  </span>
                                                  <span className="text-sm font-black text-slate-600 block mt-0.5">
                                                    {perf.hasTarget ? formatValue(perf.target, kpi.unit) : 'No Target'}
                                                  </span>
                                                </div>
                                                <div>
                                                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                                                    Achieved
                                                  </span>
                                                  <span className="text-sm font-black text-indigo-650 block mt-0.5">
                                                    {formatValue(perf.achievement, kpi.unit)}
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Progress bar */}
                                              {perf.hasTarget && (
                                                <div className="space-y-1 pt-1">
                                                  <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-slate-400 uppercase">Pace completion</span>
                                                    <span className="text-slate-800 font-extrabold">{perf.achievementPercent}%</span>
                                                  </div>
                                                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                                                    <div 
                                                      className={`h-full rounded-full transition-all duration-500 ${
                                                        perf.status === 'GREEN' 
                                                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' 
                                                          : perf.status === 'YELLOW' 
                                                            ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                                                            : 'bg-gradient-to-r from-rose-400 to-rose-500'
                                                      }`}
                                                      style={{ width: `${Math.min(perf.achievementPercent, 100)}%` }}
                                                    />
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            {/* Remaining Gap Info */}
                                            <div className="mt-3 pt-2.5 border-t border-slate-100/70 flex items-center justify-between">
                                              <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Remaining Gap:</span>
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black ${
                                                perf.gap <= 0 
                                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                                                  : 'bg-rose-50 text-rose-800 border border-rose-100'
                                              }`}>
                                                {perf.gap <= 0 ? (
                                                  perf.achievement > perf.target 
                                                    ? `Overperformed by ${formatValue(perf.achievement - perf.target, kpi.unit)}` 
                                                    : '✓ Goal Fully Met'
                                                ) : (
                                                  `${formatValue(perf.gap, kpi.unit)} remaining`
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Footer summary stats bar */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] bg-slate-50/60 p-4 border border-slate-150 rounded-xl">
                                      <div className="font-bold text-slate-500 flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mr-1">Rollup Distribution:</span>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/50 rounded-md font-extrabold">{spData.numOnTrack} On Track</span>
                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/50 rounded-md font-extrabold">{spData.numAttention} Attention</span>
                                        <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200/50 rounded-md font-extrabold">{spData.numBelow} Below Target</span>
                                      </div>
                                      <div className="font-extrabold text-slate-600 flex items-center space-x-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rollup Grade:</span> 
                                        <span className={`px-2.5 py-0.5 rounded-lg border text-[9px] font-black ${statusStyle.bg}`}>
                                          {statusStyle.badge}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* RIGHT SIDE: Accountability Panel & Actions (28%) */}
                                  <div className="p-6 lg:w-[28%] bg-gradient-to-b from-slate-50/70 to-slate-100/50 border-l border-slate-150/80 flex flex-col justify-between space-y-6">
                                    <div className="space-y-5 text-xs font-semibold">
                                      {/* SECTION A: Accountability Status Card */}
                                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-4xs space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                          <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider flex items-center">
                                            <Shield className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                            Accountability
                                          </span>
                                          {latestRev ? (
                                            <span className={`inline-flex items-center px-2 py-0.5 border text-[9px] font-black rounded-lg ${
                                              latestRev.reviewStatus !== 'Closed' && latestRev.nextReviewDate < new Date().toISOString().split('T')[0]
                                                ? 'bg-rose-50 text-rose-750 border-rose-200 animate-pulse'
                                                : revStatusStyle?.bg
                                            }`}>
                                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                                latestRev.reviewStatus !== 'Closed' && latestRev.nextReviewDate < new Date().toISOString().split('T')[0]
                                                  ? 'bg-rose-500'
                                                  : revStatusStyle?.dot
                                              }`}></span>
                                              {latestRev.reviewStatus !== 'Closed' && latestRev.nextReviewDate < new Date().toISOString().split('T')[0]
                                                ? 'OVERDUE'
                                                : latestRev.reviewStatus.toUpperCase()}
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 border text-[9px] font-black rounded-lg bg-slate-50 text-slate-550 border-slate-200">
                                              NO RECORD
                                            </span>
                                          )}
                                        </div>

                                        {/* Status & Priority rollup */}
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-150/60 flex flex-col justify-between">
                                            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-wider">Overall Rollup</span>
                                            <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 border text-[9px] font-black rounded-md ${statusStyle.bg}`}>
                                              {statusStyle.badge}
                                            </span>
                                          </div>
                                          <div className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-150/60 flex flex-col justify-between">
                                            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-wider">Priority Level</span>
                                            <span className="mt-1.5 block">
                                              {latestRev?.priority === 'High' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 font-black rounded-md text-[9px]">
                                                  🚨 HIGH
                                                </span>
                                              ) : latestRev?.priority === 'Medium' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 font-black rounded-md text-[9px]">
                                                  ⚠️ MEDIUM
                                                </span>
                                              ) : latestRev?.priority === 'Low' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-650 font-black rounded-md text-[9px]">
                                                  ⚡ LOW
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 font-black rounded-md text-[9px]">
                                                  ⚡ NORMAL
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Dates Info */}
                                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                                          <div>
                                            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-wider">Last Review</span>
                                            <span className="text-slate-800 text-[11px] font-extrabold mt-1 block flex items-center">
                                              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                              {latestRev ? new Date(latestRev.reviewDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-wider">Next Target Date</span>
                                            <span className="text-slate-800 text-[11px] font-extrabold mt-1 block flex items-center">
                                              <Calendar className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                                              {latestRev ? new Date(latestRev.nextReviewDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Set'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* SECTION B: Manager Review details */}
                                      <div className="space-y-3.5 pt-4 border-t border-slate-150">
                                        <div className="flex items-center space-x-1.5 pb-1">
                                          <span className="p-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
                                            <Award className="w-3.5 h-3.5" />
                                          </span>
                                          <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Manager Commentary & Action Plans</h5>
                                        </div>
                                        
                                        {latestRev ? (
                                          <div className="space-y-3">
                                            {latestRev.reason && (
                                              <div className="bg-amber-50/40 border border-amber-100/70 rounded-xl p-3 border-l-3 border-l-amber-500 shadow-4xs">
                                                <span className="flex items-center space-x-1.5 text-amber-800 font-black uppercase text-[8px] tracking-wider">
                                                  <AlertCircle className="w-3 h-3 text-amber-500" />
                                                  <span>Identified Gap Reason</span>
                                                </span>
                                                <span className="text-slate-700 font-bold block mt-1 text-[11px] leading-relaxed" title={latestRev.reason}>
                                                  {latestRev.reason}
                                                </span>
                                              </div>
                                            )}

                                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 shadow-4xs relative overflow-hidden">
                                              <span className="flex items-center space-x-1.5 text-slate-550 font-black uppercase text-[8px] tracking-wider">
                                                <MessageSquare className="w-3 h-3 text-slate-400" />
                                                <span>Manager Commentary</span>
                                              </span>
                                              <p className="text-slate-700 italic font-semibold mt-1.5 text-[11px] leading-relaxed pl-2.5 border-l border-slate-200" title={latestRev.managerComment}>
                                                "{latestRev.managerComment}"
                                              </p>
                                            </div>

                                            <div className="bg-indigo-50/40 border border-indigo-100/70 rounded-xl p-3 border-l-3 border-l-indigo-500 shadow-4xs">
                                              <span className="flex items-center space-x-1.5 text-indigo-900 font-black uppercase text-[8px] tracking-wider">
                                                <TrendingUp className="w-3 h-3 text-indigo-600" />
                                                <span>Corrective Action & Support Plan</span>
                                              </span>
                                              <p className="text-slate-750 font-bold mt-1 text-[11px] leading-relaxed" title={latestRev.actionPlan}>
                                                {latestRev.actionPlan}
                                              </p>
                                            </div>

                                            {latestRev.supportRequired && (
                                              <div className="bg-emerald-50/40 border border-emerald-100/70 rounded-xl p-3 border-l-3 border-l-emerald-500 shadow-4xs">
                                                <span className="flex items-center space-x-1.5 text-emerald-900 font-black uppercase text-[8px] tracking-wider">
                                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                                  <span>Support & Resource Allocation</span>
                                                </span>
                                                <p className="text-slate-750 font-bold mt-1 text-[11px] leading-relaxed" title={latestRev.supportRequired}>
                                                  {latestRev.supportRequired}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-center py-6 px-4 bg-white/40 border border-slate-200 border-dashed rounded-2xl shadow-4xs">
                                            <HelpCircle className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                                            <p className="text-slate-400 italic text-[10px] leading-relaxed font-bold">
                                              No active performance review recorded.
                                            </p>
                                            <p className="text-slate-400 text-[9px] mt-0.5">
                                              Review this salesperson to establish accountability guidelines.
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Manager CTAs */}
                                    <div className="space-y-2.5 pt-4 border-t border-slate-150">
                                      {user.role !== 'Salesperson' && (
                                        <button
                                          onClick={() => {
                                            setSelectedReviewSalesperson(spData.salesperson);
                                            const activeKpis = kpis.filter(k => k.active);
                                            if (activeKpis.length > 0) {
                                              setSelectedReviewKpiId(activeKpis[0].id);
                                            }
                                            setIsReviewModalOpen(true);
                                          }}
                                          className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-750 hover:to-indigo-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center justify-center space-x-2 border border-indigo-600 cursor-pointer"
                                        >
                                          <MessageSquare className="w-4 h-4" />
                                          <span>Review Performance</span>
                                        </button>
                                      )}

                                      <button
                                        onClick={() => {
                                          setHistorySalesperson(spData.salesperson);
                                          setIsHistoryModalOpen(true);
                                        }}
                                        className="w-full py-2.5 border border-slate-250 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 shadow-4xs cursor-pointer"
                                      >
                                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                                        <span>View Review History</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <h3 className="font-extrabold text-slate-800 text-sm mt-3">No Salespeople Found Matching Filters</h3>
                    <p className="text-slate-400 text-xs mt-1">Try resetting your filters or pick another tracking period month.</p>
                  </div>
                )}
              </div>

              {/* Informational Hint footer */}
              <div className="flex items-start space-x-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 text-[11px] text-indigo-850 leading-normal">
                <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Team Review & Gap Analysis:</strong> This business management screen allows supervisors to log systematic KPI performance intervention audits, schedule mandatory next review check-ins, record causes for targeted gaps, and layout structured, trackable recovery action plans.
                </span>
              </div>
            </div>
          )}

          {/* ====================================================
              SUB-TAB: ANALYTICAL REPORTS
              ==================================================== */}
          {activeTab === 'reports' && (
            <PerformanceReportsView
              dashboardMonth={dashboardMonth}
              setDashboardMonth={setDashboardMonth}
              teamMembers={teamMembers}
              kpis={kpis}
              targets={targets}
              achievements={achievements}
              reviews={reviews}
              businesses={businesses}
              activities={activities}
              user={user}
              onTrackThreshold={onTrackThreshold}
              needsAttentionThreshold={needsAttentionThreshold}
              handleExportPerformanceReport={handleExportPerformanceReport}
            />
          )}

          {/* ====================================================
              SUB-TAB: PERFORMANCE SETTINGS
              ==================================================== */}
          {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-3 flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">Performance Settings Matrix</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Configure target colors grading thresholds dynamically.</p>
                </div>
              </div>

              {user.role === 'Salesperson' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-55 border border-slate-155 rounded-xl text-xs leading-relaxed space-y-2 text-slate-600">
                    <span className="font-extrabold text-slate-800 uppercase block tracking-wider">🔒 Read-Only Credentials Config</span>
                    <p>Only organization managers and account owners have authorization to alter grading scales, modify objective target matrices, or create customized KPIs.</p>
                  </div>

                  <div className="space-y-3.5 pt-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Active Grading Scale Thresholds</span>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-900">
                        <span>🟢 On Track Performance</span>
                        <span>&gt;= {onTrackThreshold}% Goal achievement</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs font-bold text-amber-900">
                        <span>🟡 Needs Attention Performance</span>
                        <span>{needsAttentionThreshold}% - {onTrackThreshold - 1}% Goal achievement</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs font-bold text-rose-900">
                        <span>🔴 Below Target Performance</span>
                        <span>&lt; {needsAttentionThreshold}% Goal achievement</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveThresholds} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">🟢 On Track Goal Percent Threshold (%)</label>
                    <input
                      type="number"
                      required
                      min={needsAttentionThreshold + 1}
                      max="100"
                      value={onTrackThreshold}
                      onChange={(e) => setOnTrackThreshold(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-[9px] text-slate-450 mt-1 uppercase">Achievement percent equal to or above this number is classified as On Track.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">🟡 Needs Attention Goal Percent Threshold (%)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={onTrackThreshold - 1}
                      value={needsAttentionThreshold}
                      onChange={(e) => setNeedsAttentionThreshold(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-[9px] text-slate-455 mt-1 uppercase">Achievement percent below On Track but equal to or above this is classified as Needs Attention.</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-1"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Threshold Configs</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}

      {/* ====================================================
          MODAL: REVIEW PERFORMANCE / GAP ANALYSIS FORM
          ==================================================== */}
      {isReviewModalOpen && selectedReviewSalesperson && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-150 w-full max-w-xl shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider">Performance Gap Review</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Analyzing {selectedReviewSalesperson.name || selectedReviewSalesperson.email}
                </p>
              </div>
              <button 
                onClick={() => setIsReviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTeamReview} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* KPI Select */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">Select KPI Objective</label>
                  <select
                    value={selectedReviewKpiId}
                    onChange={(e) => setSelectedReviewKpiId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                    required
                  >
                    {kpis.filter(k => k.active).map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>

                {/* Review status */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">Review Status</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {['Open', 'Monitoring', 'Improved', 'Closed'].map((st) => (
                      <label 
                        key={st} 
                        className={`flex items-center space-x-1.5 p-1.5 border rounded-lg cursor-pointer transition-all ${
                          reviewStatusState === st 
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-extrabold' 
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reviewStatus"
                          value={st}
                          checked={reviewStatusState === st}
                          onChange={() => setReviewStatusState(st as any)}
                          className="sr-only"
                        />
                        <span className={`w-2 h-2 rounded-full ${
                          st === 'Open' ? 'bg-red-500' : st === 'Monitoring' ? 'bg-amber-400' : st === 'Improved' ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}></span>
                        <span className="text-[10px]">{st}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Review Date & Priority rating */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">Review Date</label>
                  <input
                    type="date"
                    required
                    value={reviewDateState}
                    onChange={(e) => setReviewDateState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">Priority Rating</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {['Low', 'Normal', 'Medium', 'High'].map((pr) => (
                      <label
                        key={pr}
                        className={`flex flex-col items-center justify-center p-1.5 border rounded-lg cursor-pointer transition-all ${
                          reviewPriorityState === pr
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-extrabold'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reviewPriority"
                          value={pr}
                          checked={reviewPriorityState === pr}
                          onChange={() => setReviewPriorityState(pr as any)}
                          className="sr-only"
                        />
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          pr === 'High' ? 'bg-red-500' : pr === 'Medium' ? 'bg-amber-500' : pr === 'Normal' ? 'bg-blue-400' : 'bg-slate-400'
                        } mb-1`}></span>
                        <span className="text-[9px] uppercase font-black tracking-wider">{pr}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reactive Performance Display */}
              {modalKpiPerformance && (
                <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-150 pb-1.5 mb-1.5">
                    <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Metrics Snapshot ({dashboardMonth})</span>
                    <span className={`px-2 py-0.5 text-[9px] font-black border rounded ${
                      modalKpiPerformance.perf.status === 'GREEN' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : modalKpiPerformance.perf.status === 'YELLOW' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {modalKpiPerformance.perf.status === 'GREEN' ? '🟢 ON TRACK' : modalKpiPerformance.perf.status === 'YELLOW' ? '🟡 NEEDS ATTENTION' : '🔴 BELOW TARGET'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Target</span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block">
                        {modalKpiPerformance.perf.hasTarget ? formatValue(modalKpiPerformance.perf.target, modalKpiPerformance.kpi.unit) : 'No Target'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Achievement</span>
                      <span className="font-extrabold text-indigo-650 mt-0.5 block">
                        {formatValue(modalKpiPerformance.perf.achievement, modalKpiPerformance.kpi.unit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Remaining Gap</span>
                      <span className={`font-extrabold mt-0.5 block ${modalKpiPerformance.perf.gap <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {modalKpiPerformance.perf.gap <= 0 ? '✓ Met' : formatValue(modalKpiPerformance.perf.gap, modalKpiPerformance.kpi.unit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Achievement %</span>
                      <span className="font-extrabold text-slate-900 mt-0.5 block">
                        {modalKpiPerformance.perf.hasTarget ? `${modalKpiPerformance.perf.achievementPercent}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason for Gap */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase">Reason for Gap</label>
                <div className="flex gap-2">
                  <select
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                    required
                  >
                    <option value="">-- Select Reason or Type below --</option>
                    <option value="Low pipeline volume / lack of leads">Low pipeline volume / lack of leads</option>
                    <option value="Poor follow-ups / delayed outreach">Poor follow-ups / delayed outreach</option>
                    <option value="Product pricing / negotiation hurdles">Product pricing / negotiation hurdles</option>
                    <option value="Training gaps / product knowledge issues">Training gaps / product knowledge issues</option>
                    <option value="Competition / market challenges">Competition / market challenges</option>
                    <option value="Leave of absence / holiday">Leave of absence / holiday</option>
                    <option value="Other">Other (Custom detail entered below)</option>
                  </select>
                </div>
                
                {/* Fallback Custom text area if they select Other or just want to type */}
                <input
                  type="text"
                  placeholder="Or enter custom reason details..."
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  className="w-full px-3 py-1.5 mt-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              {/* Manager Comment */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase">Manager Comment / Assessment</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe your assessment of their performance this month..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none resize-none"
                />
              </div>

              {/* Action Plan */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase">Action Plan / Recovery Program</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Specify immediate actions they must take (e.g. follow-up on all open proposals, attend knowledge-sharing workshop)..."
                  value={reviewActionPlan}
                  onChange={(e) => setReviewActionPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none resize-none"
                />
              </div>

              {/* Support Required / Resource Allocation */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-indigo-650 uppercase">Support Required & Resource Allocation</label>
                <textarea
                  rows={2}
                  placeholder="Detail any organizational help, tools, or hands-on coaching required to bridge this gap..."
                  value={reviewSupportRequired}
                  onChange={(e) => setReviewSupportRequired(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none resize-none"
                />
              </div>

              {/* Next Review Date */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase">Next Review Date</label>
                <input
                  type="date"
                  required
                  value={reviewNextDate}
                  onChange={(e) => setReviewNextDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 border-t border-slate-100 pt-3.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Performance Review'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: VIEW REVIEW HISTORY
          ==================================================== */}
      {isHistoryModalOpen && historySalesperson && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-150 w-full max-w-2xl shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider">Performance Review Logs</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Complete chronology for {historySalesperson.name || historySalesperson.email}
                </p>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 max-h-[500px] overflow-y-auto space-y-4 text-xs font-semibold">
              {reviews.filter(r => r.salespersonUid === historySalesperson.uid).length > 0 ? (
                [...reviews.filter(r => r.salespersonUid === historySalesperson.uid)]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((rev) => {
                    const statusBadge = getReviewStatusStyle(rev.reviewStatus);
                    const perfBadge = getOverallStatusStyle(rev.status);

                    return (
                      <div key={rev.id} className="border border-slate-200 bg-slate-50/50 p-4 rounded-xl space-y-3 shadow-5xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-150 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-indigo-700 text-sm">{rev.kpiName}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-black border rounded ${perfBadge.bg}`}>
                              {perfBadge.badge}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-bold">
                            <span>Review Date:</span>
                            <span className="text-slate-800 font-extrabold">{new Date(rev.reviewDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-500 font-bold text-[11px]">
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase font-black">Manager</span>
                            <span className="text-slate-800 block mt-0.5 truncate">{rev.createdBy}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase font-black">Metrics (Target/Ach.)</span>
                            <span className="text-slate-800 block mt-0.5">
                              {rev.target > 0 ? `${rev.completionPercentage || Math.round((rev.achievement / rev.target) * 100)}%` : 'No Target'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase font-black">Next Review</span>
                            <span className="text-slate-800 block mt-0.5 flex items-center">
                              <Calendar className="w-3 h-3 mr-0.5 text-slate-400" />
                              {new Date(rev.nextReviewDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase font-black">Review Status</span>
                            <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 border text-[9px] font-black rounded ${statusBadge.bg}`}>
                              <span className={`w-1 h-1 rounded-full mr-1 ${statusBadge.dot}`}></span>
                              {statusBadge.label}
                            </span>
                          </div>
                        </div>

                        {rev.reason && (
                          <div className="bg-white border border-slate-150 p-2 rounded-lg text-[11px]">
                            <span className="text-slate-400 text-[9px] font-black uppercase block">Reason for Gap:</span>
                            <span className="text-slate-700 block mt-0.5">{rev.reason}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                          <div className="bg-white border border-slate-150 p-2.5 rounded-lg">
                            <span className="text-slate-400 text-[9px] font-black uppercase block">Manager Comments:</span>
                            <p className="text-slate-700 italic mt-1 font-semibold">"{rev.managerComment || 'No comment logged.'}"</p>
                          </div>
                          <div className="bg-white border border-slate-150 p-2.5 rounded-lg">
                            <span className="text-indigo-650 text-[9px] font-black uppercase block">Action Plan:</span>
                            <p className="text-slate-700 mt-1 font-semibold">{rev.actionPlan || 'No action plan specified.'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-12 bg-slate-55 border border-slate-200 border-dashed rounded-xl">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-slate-400 italic mt-2 font-bold">No performance review history available in database.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-150 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-350 text-slate-700 rounded-xl text-xs font-bold uppercase transition-all shadow-4xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
