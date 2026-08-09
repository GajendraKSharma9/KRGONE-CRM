import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Crown, 
  TrendingUp, 
  Sparkles, 
  Target, 
  Users, 
  FileDown, 
  ChevronRight, 
  MessageSquare, 
  Activity as ActivityIcon, 
  List, 
  HelpCircle, 
  Award 
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
import { UserProfile, KPI, SalesTarget, AchievementEntry, TeamReview, Business, Activity } from '../types';

interface PerformanceReportsViewProps {
  dashboardMonth: string;
  setDashboardMonth: (val: string) => void;
  teamMembers: UserProfile[];
  kpis: KPI[];
  targets: SalesTarget[];
  achievements: AchievementEntry[];
  reviews: TeamReview[];
  businesses: Business[];
  activities: Activity[];
  user: UserProfile;
  onTrackThreshold: number;
  needsAttentionThreshold: number;
  handleExportPerformanceReport: () => void;
}

export const PerformanceReportsView: React.FC<PerformanceReportsViewProps> = ({
  dashboardMonth,
  setDashboardMonth,
  teamMembers,
  kpis,
  targets,
  achievements,
  reviews,
  businesses,
  activities,
  user,
  onTrackThreshold,
  needsAttentionThreshold,
  handleExportPerformanceReport
}) => {
  const [reportsSubTab, setReportsSubTab] = useState<'leaderboard' | 'charts' | 'drilldown' | 'ai-insights'>('leaderboard');
  const [selectedReportSalespersonUid, setSelectedReportSalespersonUid] = useState<string>('');

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

  // Re-declare period performance calculator to be self-contained
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

  const activeKpis = useMemo(() => kpis.filter(k => k.active), [kpis]);
  const activeSalespeople = useMemo(() => teamMembers.filter(m => m.role === 'Salesperson'), [teamMembers]);

  // Compute Leaderboard metrics
  const leaderboardData = useMemo(() => {
    return activeSalespeople.map(sp => {
      let totalT = 0;
      let totalA = 0;
      let targetKpisCount = 0;
      let completionRatesSum = 0;

      const kpiPerformanceList = activeKpis.map(k => {
        const m = calculatePeriodPerformance(sp.uid, k, dashboardMonth);
        if (m.hasTarget && m.target > 0) {
          totalT += m.target;
          totalA += m.achievement;
          targetKpisCount++;
          completionRatesSum += m.achievementPercent;
        }
        return { kpi: k, perf: m };
      });

      const score = targetKpisCount > 0 
        ? Math.round(completionRatesSum / targetKpisCount) 
        : (totalT > 0 ? Math.round((totalA / totalT) * 100) : 0);

      let bestKpiName = '—';
      let bestKpiPercent = -1;
      kpiPerformanceList.forEach(item => {
        if (item.perf.hasTarget && item.perf.achievementPercent > bestKpiPercent) {
          bestKpiPercent = item.perf.achievementPercent;
          bestKpiName = item.kpi.name;
        }
      });

      return {
        salesperson: sp,
        score,
        totalTarget: totalT,
        totalAchievement: totalA,
        bestKpiName,
        bestKpiPercent,
        targetKpisCount,
        metrics: kpiPerformanceList
      };
    }).sort((a, b) => b.score - a.score);
  }, [activeSalespeople, activeKpis, targets, achievements, businesses, activities, dashboardMonth, onTrackThreshold, needsAttentionThreshold]);

  // If empty state
  if (activeSalespeople.length === 0 || activeKpis.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-4 shadow-3xs" id="reports-module">
        <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">No Performance Ledger Data Found</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Please verify that active Salespeople have been registered and that target goals are allocated for {dashboardMonth} in the target setting module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="reports-module">
      {/* Premium Reports Navigation & Month Selector Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <TrendingUp className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              KRGONE Advanced Intelligence Analytics™
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-semibold max-w-xl">
            Enterprise-grade gamified podium leaderboards, multi-dimensional target vs achievement visualization dashboards, balanced performance scorecards, and AI executive commentary.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Select Month */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-4xs">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">MONTH:</span>
            <input
              type="month"
              value={dashboardMonth}
              onChange={(e) => setDashboardMonth(e.target.value)}
              className="bg-transparent border-none text-xs font-black text-slate-700 focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation (Premium Segment Controls) */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100/80 border border-slate-200 rounded-xl max-w-fit">
        <button
          onClick={() => setReportsSubTab('leaderboard')}
          className={`px-4 py-2 text-xs font-black uppercase rounded-lg tracking-wider transition-all flex items-center space-x-1.5 ${
            reportsSubTab === 'leaderboard'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>🏆 Leaderboard Podium</span>
        </button>
        <button
          onClick={() => setReportsSubTab('charts')}
          className={`px-4 py-2 text-xs font-black uppercase rounded-lg tracking-wider transition-all flex items-center space-x-1.5 ${
            reportsSubTab === 'charts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ActivityIcon className="w-3.5 h-3.5" />
          <span>📊 Multi-Chart Workspace</span>
        </button>
        <button
          onClick={() => setReportsSubTab('drilldown')}
          className={`px-4 py-2 text-xs font-black uppercase rounded-lg tracking-wider transition-all flex items-center space-x-1.5 ${
            reportsSubTab === 'drilldown'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>📄 Balanced Scorecards</span>
        </button>
        <button
          onClick={() => setReportsSubTab('ai-insights')}
          className={`px-4 py-2 text-xs font-black uppercase rounded-lg tracking-wider transition-all flex items-center space-x-1.5 ${
            reportsSubTab === 'ai-insights'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>✨ Executive AI Audit</span>
        </button>
      </div>

      {/* RENDER ACTIVE SUB-TAB CONTENT */}
      {(() => {
        // SUB-TAB 1: LEADERBOARD PODIUM
        if (reportsSubTab === 'leaderboard') {
          const firstPlace = leaderboardData[0];
          const secondPlace = leaderboardData[1];
          const thirdPlace = leaderboardData[2];

          return (
            <div className="space-y-6">
              {/* Premium 3D Podium Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
                
                {/* 2ND PLACE PODIUM CARD */}
                {secondPlace ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col items-center text-center space-y-3.5 order-2 md:order-1 border-b-4 border-b-slate-300 md:h-[280px] justify-between relative overflow-hidden group hover:border-slate-300 transition-all">
                    <div className="absolute top-2 left-2 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-md">
                      2ND
                    </div>
                    <div className="space-y-2">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-300 text-slate-700 flex items-center justify-center font-black text-lg shadow-inner">
                        {secondPlace.salesperson.name ? secondPlace.salesperson.name.substring(0, 2).toUpperCase() : 'SP'}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm tracking-tight truncate max-w-[180px]">
                          {secondPlace.salesperson.name || secondPlace.salesperson.email}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Sales Elite Associate</p>
                      </div>
                    </div>

                    <div className="space-y-2 w-full">
                      <div className="bg-slate-50 border border-slate-150 p-2 rounded-xl">
                        <span className="block text-[8px] text-slate-400 font-black uppercase">Goal Pacing</span>
                        <span className="text-xl font-black text-slate-800">{secondPlace.score}%</span>
                      </div>
                      <span className="text-[9px] text-slate-450 font-bold uppercase block">
                        Top: {secondPlace.bestKpiName} ({secondPlace.bestKpiPercent}%)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-400 italic text-xs order-2 md:order-1 h-[240px] flex items-center justify-center">
                    No 2nd Place Record
                  </div>
                )}

                {/* 1ST PLACE GOLD CHAMPION CARD */}
                {firstPlace ? (
                  <div className="bg-gradient-to-b from-indigo-50/50 to-white border-2 border-indigo-600 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center space-y-4 order-1 md:order-2 border-b-6 border-b-indigo-600 md:h-[320px] justify-between relative overflow-hidden group hover:scale-[1.01] transition-all">
                    <div className="absolute top-2 right-2 flex items-center space-x-1 bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                      <Crown className="w-3.5 h-3.5 text-amber-300" />
                      <span>CHAMPION</span>
                    </div>
                    <div className="space-y-2">
                      <div className="w-18 h-18 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border-3 border-amber-400 text-amber-800 flex items-center justify-center font-black text-2xl shadow-md ring-4 ring-indigo-50">
                        {firstPlace.salesperson.name ? firstPlace.salesperson.name.substring(0, 2).toUpperCase() : 'SP'}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base tracking-tight truncate max-w-[200px]">
                          {firstPlace.salesperson.name || firstPlace.salesperson.email}
                        </h4>
                        <p className="text-[10px] text-indigo-600 font-extrabold uppercase mt-0.5 flex items-center justify-center space-x-1">
                          <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Gold Performer of Month</span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 w-full">
                      <div className="bg-indigo-600 text-white p-3.5 rounded-2xl shadow-sm">
                        <span className="block text-[8px] text-indigo-200 font-black uppercase tracking-wider">Overall Goal Completion</span>
                        <span className="text-2xl font-black text-white block mt-0.5">{firstPlace.score}%</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block">
                        Top: {firstPlace.bestKpiName} ({firstPlace.bestKpiPercent}%)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-400 italic text-xs order-1 md:order-2 h-[280px] flex items-center justify-center">
                    No Champion Record
                  </div>
                )}

                {/* 3RD PLACE PODIUM CARD */}
                {thirdPlace ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col items-center text-center space-y-3.5 order-3 border-b-4 border-b-amber-600/70 md:h-[260px] justify-between relative overflow-hidden group hover:border-slate-300 transition-all">
                    <div className="absolute top-2 left-2 bg-amber-50 border border-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                      3RD
                    </div>
                    <div className="space-y-2">
                      <div className="w-13 h-13 rounded-full bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-500/50 text-amber-900 flex items-center justify-center font-black text-base shadow-inner">
                        {thirdPlace.salesperson.name ? thirdPlace.salesperson.name.substring(0, 2).toUpperCase() : 'SP'}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm tracking-tight truncate max-w-[180px]">
                          {thirdPlace.salesperson.name || thirdPlace.salesperson.email}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Bronze Elite Associate</p>
                      </div>
                    </div>

                    <div className="space-y-2 w-full">
                      <div className="bg-slate-50 border border-slate-150 p-2 rounded-xl">
                        <span className="block text-[8px] text-slate-400 font-black uppercase">Goal Pacing</span>
                        <span className="text-lg font-black text-slate-800">{thirdPlace.score}%</span>
                      </div>
                      <span className="text-[9px] text-slate-450 font-bold uppercase block">
                        Top: {thirdPlace.bestKpiName} ({thirdPlace.bestKpiPercent}%)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-400 italic text-xs order-3 h-[240px] flex items-center justify-center">
                    No 3rd Place Record
                  </div>
                )}

              </div>

              {/* Leaderboard Table Grid of the Rest of the Team */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                    <List className="w-4 h-4 text-indigo-600 mr-1.5" />
                    Comprehensive Performance Rankings
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Ranked by aggregate monthly target achievement rates across all objective metrics.</p>
                </div>

                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[9px] tracking-wider">
                        <th className="py-3.5 px-4 w-[60px] text-center">Rank</th>
                        <th className="py-3.5 px-4">Salesperson</th>
                        <th className="py-3.5 px-4 text-center">Aggregate Completion</th>
                        <th className="py-3.5 px-4 text-center">Active Targets</th>
                        <th className="py-3.5 px-4">Outstanding Contributor Metric</th>
                        <th className="py-3.5 px-4 text-center">Status Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {leaderboardData.map((row, index) => {
                        const rank = index + 1;
                        let medal = '';
                        if (rank === 1) medal = '🥇';
                        else if (rank === 2) medal = '🥈';
                        else if (rank === 3) medal = '🥉';

                        return (
                          <tr key={row.salesperson.uid} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 text-center font-black text-slate-900">
                              {medal ? <span className="text-lg">{medal}</span> : rank}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-xs">
                                  {row.salesperson.name ? row.salesperson.name.substring(0, 2).toUpperCase() : 'SP'}
                                </div>
                                <div>
                                  <span className="font-extrabold text-slate-900 block">{row.salesperson.name || row.salesperson.email}</span>
                                  <span className="text-[9px] text-slate-400 block font-bold uppercase">{row.salesperson.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex items-center space-x-1 bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-lg">
                                <span className="font-black text-indigo-700">{row.score}%</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-600 font-bold">
                              {row.targetKpisCount} KPIs set
                            </td>
                            <td className="py-3.5 px-4">
                              {row.bestKpiPercent >= 0 ? (
                                <div className="space-y-0.5">
                                  <span className="text-slate-800 font-extrabold block">{row.bestKpiName}</span>
                                  <span className="text-[9px] text-emerald-600 font-extrabold uppercase">Achieved {row.bestKpiPercent}% of goal</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 italic">No target completed</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 border text-[9px] font-black rounded-md ${
                                row.score >= onTrackThreshold 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-250' 
                                  : row.score >= needsAttentionThreshold 
                                    ? 'bg-amber-50 text-amber-800 border-amber-250' 
                                    : 'bg-rose-50 text-rose-800 border-rose-250'
                              }`}>
                                {row.score >= onTrackThreshold ? 'ON TRACK' : row.score >= needsAttentionThreshold ? 'ATTENTION' : 'BELOW GOAL'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Goal Crushers Highlights Section */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                  <h4 className="text-sm font-black uppercase tracking-wider">The Month's Goal Crushers</h4>
                </div>
                <p className="text-xs text-emerald-100 max-w-2xl font-medium">
                  These high-achievers have exceeded 100% of their aggregated target matrices this period, demonstrating outstanding execution capability:
                </p>
                <div className="flex flex-wrap gap-3">
                  {leaderboardData.filter(r => r.score >= 100).map(r => (
                    <div key={r.salesperson.uid} className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl px-4 py-2 flex items-center space-x-2">
                      <span className="text-base">🚀</span>
                      <div>
                        <span className="font-extrabold text-white text-xs block">{r.salesperson.name || r.salesperson.email}</span>
                        <span className="text-[9px] text-emerald-200 font-black block">{r.score}% Goal Crusher</span>
                      </div>
                    </div>
                  ))}
                  {leaderboardData.filter(r => r.score >= 100).length === 0 && (
                    <span className="text-xs text-emerald-100 italic font-bold">No salespeople have breached the 100% target cap yet. Support the team to unlock milestone celebrations!</span>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // SUB-TAB 2: MULTI-CHART WORKSPACE
        if (reportsSubTab === 'charts') {
          const chartData = leaderboardData.map(row => {
            const dataObj: any = { name: row.salesperson.name || row.salesperson.email };
            row.metrics.forEach(m => {
              dataObj[`${m.kpi.name} Target`] = m.perf.target;
              dataObj[`${m.kpi.name} Actual`] = m.perf.achievement;
            });
            return dataObj;
          });

          let totalRatedKpis = 0;
          let greenCount = 0;
          let yellowCount = 0;
          let redCount = 0;

          leaderboardData.forEach(row => {
            row.metrics.forEach(m => {
              if (m.perf.hasTarget && m.perf.target > 0) {
                totalRatedKpis++;
                if (m.perf.status === 'GREEN') greenCount++;
                else if (m.perf.status === 'YELLOW') yellowCount++;
                else redCount++;
              }
            });
          });

          const pieData = [
            { name: 'On Track (>=90%)', value: greenCount, color: '#10b981' },
            { name: 'Needs Attention (70-89%)', value: yellowCount, color: '#f59e0b' },
            { name: 'Below Target (<70%)', value: redCount, color: '#ef4444' }
          ].filter(p => p.value > 0);

          const finalPieData = pieData.length > 0 ? pieData : [{ name: 'No Active Targets', value: 1, color: '#cbd5e1' }];

          const trendMonths = (() => {
            const list: string[] = [];
            const [yearStr, monthStr] = dashboardMonth.split('-');
            let y = parseInt(yearStr, 10);
            let m = parseInt(monthStr, 10);
            for (let i = 5; i >= 0; i--) {
              let targetM = m - i;
              let targetY = y;
              if (targetM <= 0) {
                targetM += 12;
                targetY -= 1;
              }
              list.push(`${targetY}-${String(targetM).padStart(2, '0')}`);
            }
            return list;
          })();

          const trendChartData = trendMonths.map(month => {
            let totalTarget = 0;
            let totalAchievement = 0;

            activeSalespeople.forEach(sp => {
              activeKpis.forEach(k => {
                const m = calculatePeriodPerformance(sp.uid, k, month);
                if (m.hasTarget) {
                  totalTarget += m.target;
                  totalAchievement += m.achievement;
                } else {
                  totalAchievement += m.achievement;
                }
              });
            });

            const [yr, mn] = month.split('-');
            const dateLabel = new Date(parseInt(yr, 10), parseInt(mn, 10) - 1, 1)
              .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            return {
              month,
              label: dateLabel,
              'Total Target': totalTarget,
              'Total Achievement': totalAchievement
            };
          });

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* CHART A: Goal vs Achievement Grouped Bar */}
                <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                      <ActivityIcon className="w-4 h-4 text-indigo-600 mr-1.5" />
                      Grouped Target vs Actual Accomplishments
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Compares monthly target allocation against raw achievements per salesperson.</p>
                  </div>

                  <div className="h-[300px] w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight={800} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '800' }} />
                        {activeKpis.map((k, idx) => {
                          const colors = [
                            { target: '#e2e8f0', actual: '#4f46e5' },
                            { target: '#cbd5e1', actual: '#0ea5e9' },
                            { target: '#94a3b8', actual: '#10b981' }
                          ];
                          const c = colors[idx % colors.length];
                          return (
                            <React.Fragment key={k.id}>
                              <Bar dataKey={`${k.name} Target`} fill={c.target} name={`${k.name} Goal`} radius={[3, 3, 0, 0]} />
                              <Bar dataKey={`${k.name} Actual`} fill={c.actual} name={`${k.name} Actual`} radius={[3, 3, 0, 0]} />
                            </React.Fragment>
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CHART B: Distribution Donut/Pie */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs flex flex-col justify-between space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                      <Target className="w-4 h-4 text-indigo-600 mr-1.5" />
                      KPI Rating Distribution
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Aggregate performance status ratio of all allocated goals this month.</p>
                  </div>

                  <div className="h-[200px] w-full relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={finalPieData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {finalPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-black text-slate-800">{totalRatedKpis}</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Total Targets</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    {finalPieData.map((d, index) => (
                      <div key={index} className="flex items-center justify-between text-[11px] font-bold">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                          <span className="text-slate-500 truncate max-w-[150px]">{d.name}</span>
                        </div>
                        <span className="text-slate-800 font-extrabold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* CHART C: 6-Month Sales Velocity Trend */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs space-y-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center">
                    <TrendingUp className="w-4 h-4 text-indigo-600 mr-1.5" />
                    6-Month Organization Sales Velocity Trend
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Chronological rolling history of aggregate organization achievements and assigned goals.</p>
                </div>

                <div className="h-[260px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorAchievement" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={10} fontWeight={800} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '800' }} />
                      <Area type="monotone" dataKey="Total Achievement" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorAchievement)" name="Total Achievements Accumulation" />
                      <Line type="monotone" dataKey="Total Target" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} name="Base Target Matrix" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        }

        // SUB-TAB 3: BALANCED SCORECARD DRILLDOWN
        if (reportsSubTab === 'drilldown') {
          const currentUid = selectedReportSalespersonUid || leaderboardData[0].salesperson.uid;
          const currentRecord = leaderboardData.find(r => r.salesperson.uid === currentUid) || leaderboardData[0];

          return (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4.5 shadow-3xs space-y-3 max-h-[550px] overflow-y-auto">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-2">Select Salesperson</span>
                <div className="space-y-1.5">
                  {leaderboardData.map(row => {
                    const isSelected = row.salesperson.uid === currentUid;
                    return (
                      <button
                        key={row.salesperson.uid}
                        onClick={() => setSelectedReportSalespersonUid(row.salesperson.uid)}
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                            : 'bg-slate-50/50 border-slate-150 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <span className={`font-extrabold text-xs block truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                            {row.salesperson.name || row.salesperson.email}
                          </span>
                          <span className={`text-[8px] font-bold uppercase tracking-wider block ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                            Score: {row.score}%
                          </span>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'translate-x-1 text-white' : 'text-slate-400 group-hover:translate-x-1'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-extrabold text-base shadow-inner">
                      {currentRecord.salesperson.name ? currentRecord.salesperson.name.substring(0, 2).toUpperCase() : 'SP'}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
                        {currentRecord.salesperson.name || currentRecord.salesperson.email}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="bg-slate-50 border border-slate-150 px-2 py-0.5 rounded text-[9px] font-bold uppercase text-slate-500">
                          {currentRecord.salesperson.email}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">{currentRecord.targetKpisCount} KPIs Assigned</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 text-center min-w-[120px]">
                    <span className="block text-[8px] text-slate-400 font-black uppercase tracking-wider">MONTHLY SCORE</span>
                    <span className="text-2xl font-black text-white block mt-0.5">{currentRecord.score}%</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Objective Scorecard Audit</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentRecord.metrics.map(({ kpi, perf }) => {
                      let trendLabel = '➡️ Steady';
                      let trendColor = 'text-slate-500 bg-slate-50';
                      if (perf.achievementPercent >= onTrackThreshold) {
                        trendLabel = '📈 Excelling';
                        trendColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                      } else if (perf.achievementPercent < needsAttentionThreshold) {
                        trendLabel = '📉 Lagging';
                        trendColor = 'text-rose-700 bg-rose-50 border-rose-105';
                      }

                      return (
                        <div key={kpi.id} className="bg-slate-50/50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3 hover:shadow-4xs transition-all">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <h5 className="font-extrabold text-slate-800 text-xs">{kpi.name}</h5>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Format: {kpi.unit}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${trendColor}`}>
                              {trendLabel}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1 py-2 text-center border-y border-slate-200/50">
                            <div>
                              <span className="text-[8px] text-slate-400 font-black uppercase block">Goal</span>
                              <span className="text-xs font-black text-slate-700 mt-0.5 block">
                                {perf.hasTarget ? formatValue(perf.target, kpi.unit) : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-black uppercase block">Actual</span>
                              <span className="text-xs font-black text-indigo-650 mt-0.5 block">
                                {formatValue(perf.achievement, kpi.unit)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 font-black uppercase block">Gap</span>
                              <span className={`text-xs font-black mt-0.5 block ${perf.gap <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {perf.gap <= 0 ? '✓ Met' : formatValue(perf.gap, kpi.unit)}
                              </span>
                            </div>
                          </div>

                          {perf.hasTarget && (
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-slate-450">Pacing completion</span>
                                <span className="text-slate-800 font-black">{perf.achievementPercent}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    perf.status === 'GREEN' 
                                      ? 'bg-emerald-500' 
                                      : perf.status === 'YELLOW' 
                                        ? 'bg-amber-500' 
                                        : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(perf.achievementPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const associatedReviews = reviews.filter(r => 
                    r.salespersonUid === currentUid && 
                    r.reviewDate && 
                    r.reviewDate.substring(0, 7) === dashboardMonth
                  );

                  return (
                    <div className="border-t border-slate-150 pt-5 space-y-3.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center">
                        <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        Manager Accountabilities & Interventions Comments
                      </span>
                      
                      {associatedReviews.length > 0 ? (
                        <div className="space-y-3">
                          {associatedReviews.map((rev, idx) => (
                            <div key={rev.id || idx} className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-4 space-y-3 shadow-4xs">
                              <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                                <span className="font-extrabold text-[10px] text-indigo-900 uppercase tracking-wider">
                                  Review logged: {rev.reviewDate}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                  rev.reviewStatus === 'Improved' 
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}>
                                  {rev.reviewStatus}
                                </span>
                              </div>
                              <p className="text-slate-700 italic font-semibold text-xs leading-relaxed">
                                "{rev.managerComment || 'No feedback details entered.'}"
                              </p>
                              {rev.actionPlan && (
                                <div className="pt-2 border-t border-indigo-100/40 space-y-1">
                                  <span className="text-[8px] font-black text-indigo-700 uppercase tracking-wider block">Recovery Action Plan:</span>
                                  <p className="text-[11px] text-slate-600 font-bold leading-normal">{rev.actionPlan}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-400 italic text-xs">
                          No performance review audits or comments logged for this salesperson during the period of {dashboardMonth}.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        }

        // SUB-TAB 4: EXECUTIVE AI AUDIT
        if (reportsSubTab === 'ai-insights') {
          const champion = leaderboardData[0];
          const bottomPerformer = leaderboardData[leaderboardData.length - 1];

          let maxGapVal = -1;
          let maxGapKpiName = '—';
          let maxGapSalespersonName = '—';

          leaderboardData.forEach(row => {
            row.metrics.forEach(m => {
              if (m.perf.hasTarget && m.perf.gap > maxGapVal) {
                maxGapVal = m.perf.gap;
                maxGapKpiName = m.kpi.name;
                maxGapSalespersonName = row.salesperson.name || row.salesperson.email;
              }
            });
          });

          let overallT = 0;
          let overallA = 0;
          leaderboardData.forEach(row => {
            overallT += row.totalTarget;
            overallA += row.totalAchievement;
          });
          const orgRate = overallT > 0 ? Math.round((overallA / overallT) * 100) : 0;

          return (
            <div className="space-y-6">
              
              <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm space-y-4 border border-slate-800 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl"></div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Automated Corporate Executive Analysis</h3>
                </div>
                <h4 className="text-xl font-black tracking-tight max-w-2xl text-white">
                  KRGONE Performance Commentary & Coaching Recommendation Ledger
                </h4>
                <p className="text-xs text-slate-400 max-w-2xl font-medium">
                  Dynamic, live-computed operational diagnostic mapping milestones, core business gaps, and structured correction procedures to aid organizational target bridging.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-3xs space-y-4">
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md uppercase tracking-wider inline-block">
                    🏆 Strategic Performance Milestones
                  </span>
                  <div className="space-y-4 font-semibold text-slate-700 text-xs leading-relaxed">
                    <p>
                      <strong>Elite Execution Anchor:</strong> <span className="text-slate-900 font-extrabold">{champion.salesperson.name || champion.salesperson.email}</span> has distinguished themselves as the premier performer this month, registering an aggregate target completion score of <span className="text-indigo-600 font-black">{champion.score}%</span>. Their outstanding work in <span className="text-slate-800 font-extrabold">{champion.bestKpiName}</span> is a key playbook that should be documented and replicated.
                    </p>
                    {champion.score >= 100 && (
                      <p className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-[11px] leading-normal italic text-slate-500 pl-3.5 border-l-3 border-l-emerald-500">
                        "Our top performer has breached the 100% target milestone. This suggests the assigned goals were aggressive yet achievable with optimal pipeline discipline."
                      </p>
                    )}
                    <p>
                      <strong>Organization Velocity roll-up:</strong> The entire organization is currently performing at an aggregate pace of <span className="text-slate-900 font-extrabold">{orgRate}%</span> of the total monthly target matrix.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-3xs space-y-4">
                  <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-md uppercase tracking-wider inline-block">
                    🚨 Vulnerability & Gap Audit
                  </span>
                  <div className="space-y-4 font-semibold text-slate-700 text-xs leading-relaxed">
                    {bottomPerformer && bottomPerformer.salesperson.uid !== champion.salesperson.uid ? (
                      <p>
                        <strong>Coaching Opportunity:</strong> Performance monitoring indicators highlight <span className="text-slate-900 font-extrabold">{bottomPerformer.salesperson.name || bottomPerformer.salesperson.email}</span> as a critical focus area, with an aggregate goal completion of <span className="text-rose-600 font-extrabold">{bottomPerformer.score}%</span>. Immediate supervisor check-ins are recommended.
                      </p>
                    ) : (
                      <p>
                        <strong>Homogenous Pacing:</strong> Team achievement scores show tightly clustered progress. No single salesperson is severely lagging, reflecting consistent organizational execution.
                      </p>
                    )}
                    {maxGapVal > 0 && (
                      <p>
                        <strong>Critical Goal Bottleneck:</strong> The highest numeric gap identified across the company ledger stands at <span className="text-rose-600 font-extrabold">{maxGapVal} units</span>, located in the <span className="text-slate-800 font-extrabold">{maxGapKpiName}</span> metric (assigned to <span className="text-slate-800 font-extrabold">{maxGapSalespersonName}</span>). Addressing this gap will yield the highest margin of target recovery.
                      </p>
                    )}
                  </div>
                </div>

              </div>

              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-4xs space-y-3">
                <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider block">🩺 Organizational Coaching Diagnostic</span>
                {orgRate < needsAttentionThreshold ? (
                  <div className="space-y-2 text-xs font-semibold leading-relaxed text-slate-600">
                    <h5 className="font-extrabold text-rose-800 text-xs">⚠️ Core Volume Lag Alert</h5>
                    <p>
                      The organization is pacing below the required attention boundary ({needsAttentionThreshold}%). Experience indicates this is usually a symptom of early-stage funnel erosion. Outbound call volumes and meeting frequencies should be scrutinized. Supervisors must implement a 5-day structured dial sprint to build momentum.
                    </p>
                  </div>
                ) : orgRate < onTrackThreshold ? (
                  <div className="space-y-2 text-xs font-semibold leading-relaxed text-slate-600">
                    <h5 className="font-extrabold text-amber-800 text-xs">⚖️ Steady State Pipeline Bridge</h5>
                    <p>
                      The organization is close to bridging the monthly goal target gap ({orgRate}% current pacing). This represents a stable team performance, but requires target spot coaching on closing techniques and pitch conversion rate management to transition the ledger to "On Track". We recommend auditing active deals valued above ₹5 Lakhs for immediate support.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs font-semibold leading-relaxed text-slate-600">
                    <h5 className="font-extrabold text-emerald-800 text-xs">✨ High-Performance Velocity Validation</h5>
                    <p>
                      The organization is operating at maximum target pace ({orgRate}%). This is an exemplary performance that reflects robust CRM hygiene and active manual logging compliance. Focus should shift from corrective interventions to institutionalizing these habits. Ensure champion playbooks are documented for onboarding future team members.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Strategic Action Playbook</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                    <div className="w-7 h-7 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-center text-indigo-600 text-xs font-black">1</div>
                    <h5 className="font-extrabold text-slate-900 text-xs">Playbook Peer Mentoring</h5>
                    <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                      Coordinate a 30-minute workspace review where <span className="text-slate-800 font-bold">{champion.salesperson.name || champion.salesperson.email}</span> shares their pitch script and deal follow-up cadence for <span className="text-indigo-600 font-bold">{champion.bestKpiName}</span>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                    <div className="w-7 h-7 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-center text-indigo-600 text-xs font-black">2</div>
                    <h5 className="font-extrabold text-slate-900 text-xs">Gap Pipeline Scrubbing</h5>
                    <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                      Directly scrutinize the active CRM opportunities for <span className="text-slate-850 font-bold">{maxGapKpiName}</span>. Allocate auxiliary team assets to help bridge the {maxGapVal} gap.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                    <div className="w-7 h-7 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-center text-indigo-600 text-xs font-black">3</div>
                    <h5 className="font-extrabold text-slate-900 text-xs">Threshold Incentivization</h5>
                    <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                      Activate a micro-incentive or structured coaching sprint over the next 10 days, targeted at salespeople pacing in the "Attention" tier (70-89%) to push them into "On Track" (at least 90%).
                    </p>
                  </div>

                </div>
              </div>

            </div>
          );
        }

        return null;
      })()}
    </div>
  );
};
