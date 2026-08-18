import { Business, Activity, UserProfile } from '../types';

export type LeadHealthStatus = 'HEALTHY' | 'NEEDS ATTENTION' | 'AT RISK';

/**
 * Calculate lead health based on temperature, activity recency, and follow-up status.
 */
export function calculateLeadHealth(business: Business, activities: Activity[] = []): LeadHealthStatus {
  const status = (business.status || 'NEW').toUpperCase();
  if (status === 'WON' || status === 'WON') return 'HEALTHY';
  if (status === 'LOST' || status === 'LOST') return 'HEALTHY';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find latest activity date for this business
  const bizActivities = activities.filter(a => a.businessId === business.id);
  let latestDate: Date | null = null;

  if (bizActivities.length > 0) {
    bizActivities.forEach(a => {
      const d = new Date(a.activityDate || a.createdAt);
      if (!isNaN(d.getTime())) {
        if (!latestDate || d > latestDate) latestDate = d;
      }
    });
  }

  if (!latestDate && business.updatedAt) {
    const d = new Date(business.updatedAt);
    if (!isNaN(d.getTime())) latestDate = d;
  }

  if (!latestDate && business.createdAt) {
    const d = new Date(business.createdAt);
    if (!isNaN(d.getTime())) latestDate = d;
  }

  const daysSinceLastContact = latestDate
    ? Math.floor((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const temp = business.leadTemperature || business.temperature || 'WARM';
  let baseHealth: LeadHealthStatus = 'HEALTHY';

  if (temp === 'HOT') {
    if (daysSinceLastContact > 3) baseHealth = 'AT RISK';
    else baseHealth = 'HEALTHY';
  } else if (temp === 'WARM') {
    if (daysSinceLastContact > 7) baseHealth = 'NEEDS ATTENTION';
    else baseHealth = 'HEALTHY';
  } else {
    // COLD
    if (daysSinceLastContact > 14) baseHealth = 'NEEDS ATTENTION';
    else baseHealth = 'HEALTHY';
  }

  // Check for overdue follow-up
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (business.nextFollowUpDate && business.nextFollowUpDate < todayStr) {
    if (baseHealth === 'HEALTHY') return 'NEEDS ATTENTION';
    if (baseHealth === 'NEEDS ATTENTION') return 'AT RISK';
    return 'AT RISK';
  }

  return baseHealth;
}

/**
 * Calculate lead velocity metrics (age, stage duration)
 */
export function calculateLeadVelocity(business: Business, activities: Activity[] = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const createdDate = business.createdAt ? new Date(business.createdAt) : today;
  const totalAgeDays = Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));

  const updatedDate = business.updatedAt ? new Date(business.updatedAt) : createdDate;
  const daysInCurrentStage = Math.max(0, Math.floor((today.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate time between stage transitions if activities exist
  const bizActs = activities.filter(a => a.businessId === business.id).sort((a, b) => 
    new Date(a.activityDate || a.createdAt).getTime() - new Date(b.activityDate || b.createdAt).getTime()
  );

  return {
    totalAgeDays,
    daysInCurrentStage,
    activityCount: bizActs.length,
    lastActivityDate: bizActs.length > 0 ? bizActs[bizActs.length - 1].activityDate : business.updatedAt || business.createdAt
  };
}

/**
 * Interface for Team Performance Metrics
 */
export interface TeamMemberMetrics {
  user: UserProfile;
  role: string;
  assignedLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  proposalLeads: number;
  wonDeals: number;
  lostDeals: number;
  totalActivities: number;
  followUpsDue: number;
  overdueFollowUps: number;
  contactRate: string;
  qualificationRate: string;
  conversionRate: string;
}

export function getTeamPerformanceMetrics(
  businesses: Business[],
  activities: Activity[],
  teamMembers: UserProfile[]
): TeamMemberMetrics[] {
  const todayStr = new Date().toISOString().split('T')[0];

  return teamMembers.map(member => {
    const memberName = (member.name || member.email || '').toLowerCase();

    // Find assigned leads
    const assigned = businesses.filter(b => {
      const tele = (b.assignedTelecaller || b.assignedTelecallerName || '').toLowerCase();
      const sales = (b.assignedSalesperson || b.assignedSalespersonName || '').toLowerCase();
      return (tele && tele.includes(memberName)) || (sales && sales.includes(memberName));
    });

    const contacted = assigned.filter(b => b.status === 'CONTACTED' || b.status === 'QUALIFIED' || b.status === 'PROPOSAL' || b.status === 'WON' || b.status === 'Won');
    const qualified = assigned.filter(b => b.status === 'QUALIFIED' || b.status === 'PROPOSAL' || b.status === 'WON' || b.status === 'Won');
    const proposal = assigned.filter(b => b.status === 'PROPOSAL' || b.status === 'WON' || b.status === 'Won');
    const won = assigned.filter(b => b.status === 'WON' || b.status === 'Won');
    const lost = assigned.filter(b => b.status === 'LOST' || b.status === 'Lost');

    const memberActs = activities.filter(a => (a.userName || '').toLowerCase().includes(memberName) || a.userId === member.uid);

    const followUpsDue = assigned.filter(b => b.nextFollowUpDate === todayStr && b.status !== 'WON' && b.status !== 'Won' && b.status !== 'LOST' && b.status !== 'Lost').length;
    const overdueFollowUps = assigned.filter(b => b.nextFollowUpDate && b.nextFollowUpDate < todayStr && b.status !== 'WON' && b.status !== 'Won' && b.status !== 'LOST' && b.status !== 'Lost').length;

    const totalAssigned = assigned.length;
    const contactRate = totalAssigned > 0 ? ((contacted.length / totalAssigned) * 100).toFixed(1) + '%' : '0.0%';
    const qualRate = contacted.length > 0 ? ((qualified.length / contacted.length) * 100).toFixed(1) + '%' : '0.0%';
    const convRate = totalAssigned > 0 ? ((won.length / totalAssigned) * 100).toFixed(1) + '%' : '0.0%';

    return {
      user: member,
      role: member.role || 'Telecaller',
      assignedLeads: totalAssigned,
      contactedLeads: contacted.length,
      qualifiedLeads: qualified.length,
      proposalLeads: proposal.length,
      wonDeals: won.length,
      lostDeals: lost.length,
      totalActivities: memberActs.length,
      followUpsDue,
      overdueFollowUps,
      contactRate,
      qualificationRate: qualRate,
      conversionRate: convRate
    };
  });
}

/**
 * Activity Channel Analysis Metrics
 */
export function getChannelAnalysis(activities: Activity[], businesses: Business[]) {
  const bizMap = new Map<string, Business>();
  businesses.forEach(b => { if (b.id) bizMap.set(b.id, b); });

  const channels = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Note'] as const;
  
  return channels.map(channel => {
    const channelActs = activities.filter(a => (a.type || a.channel || '').toLowerCase() === channel.toLowerCase());
    
    // Unique business IDs involved
    const bizIds = new Set(channelActs.map(a => a.businessId).filter(Boolean));
    const leadsInvolved = Array.from(bizIds).map(id => bizMap.get(id)).filter(Boolean) as Business[];

    const qualified = leadsInvolved.filter(b => b.status === 'QUALIFIED' || b.status === 'PROPOSAL' || b.status === 'WON' || b.status === 'Won').length;
    const proposal = leadsInvolved.filter(b => b.status === 'PROPOSAL' || b.status === 'WON' || b.status === 'Won').length;
    const won = leadsInvolved.filter(b => b.status === 'WON' || b.status === 'Won').length;

    return {
      channel,
      totalActivities: channelActs.length,
      uniqueLeads: leadsInvolved.length,
      qualifiedLeads: qualified,
      proposalLeads: proposal,
      wonDeals: won
    };
  });
}

/**
 * Export Businesses to CSV
 */
export function exportBusinessesToCSV(businesses: Business[], activities: Activity[] = []): void {
  const headers = [
    'Company Name',
    'Contact Person',
    'Mobile',
    'Email',
    'City',
    'Industry',
    'Lead Status',
    'Lead Temperature',
    'Lead Health',
    'Assigned Telecaller',
    'Assigned Salesperson',
    'Next Follow-Up Date',
    'Next Action',
    'Tags',
    'Created Date'
  ];

  const activitiesByBizId: Record<string, Activity[]> = {};
  activities.forEach(a => {
    if (a.businessId) {
      if (!activitiesByBizId[a.businessId]) {
        activitiesByBizId[a.businessId] = [];
      }
      activitiesByBizId[a.businessId].push(a);
    }
  });

  const rows = businesses.map(b => {
    const bizActs = b.id ? (activitiesByBizId[b.id] || []) : [];
    const health = calculateLeadHealth(b, bizActs);
    const tagsStr = (b.tags || []).join('; ');

    return [
      `"${(b.companyName || '').replace(/"/g, '""')}"`,
      `"${(b.contactPerson || '').replace(/"/g, '""')}"`,
      `"${(b.mobile || '').replace(/"/g, '""')}"`,
      `"${(b.email || '').replace(/"/g, '""')}"`,
      `"${(b.city || '').replace(/"/g, '""')}"`,
      `"${(b.industry || '').replace(/"/g, '""')}"`,
      `"${b.status || 'NEW'}"`,
      `"${b.temperature || b.leadTemperature || 'WARM'}"`,
      `"${health}"`,
      `"${(b.assignedTelecaller || b.assignedTelecallerName || '').replace(/"/g, '""')}"`,
      `"${(b.assignedSalesperson || b.assignedSalespersonName || '').replace(/"/g, '""')}"`,
      `"${b.nextFollowUpDate || ''}"`,
      `"${(b.nextAction || '').replace(/"/g, '""')}"`,
      `"${tagsStr.replace(/"/g, '""')}"`,
      `"${b.createdAt || ''}"`
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `KRGONE_Leads_Export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
