export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  organizationId: string;
  role?: 'Manager' | 'Telecaller' | 'Salesperson';
  active?: boolean;
  monthlyTarget?: number;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  monthlyTeamTarget?: number;
  createdAt: string;
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST' | 'New' | 'Proposal' | 'Won' | 'Lost';
export type LeadTemperature = 'HOT' | 'WARM' | 'COLD';
export type BusinessStatus = LeadStatus;

export interface Business {
  id?: string;
  organizationId: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  industry: string;
  city?: string;
  status: BusinessStatus;
  temperature?: LeadTemperature;
  leadTemperature?: LeadTemperature;
  assignedTelecaller?: string;
  assignedTelecallerId?: string;
  assignedTelecallerName?: string;
  assignedSalesperson?: string;
  assignedSalespersonId?: string;
  assignedSalespersonName?: string;
  nextFollowUpDate?: string; // YYYY-MM-DD
  nextAction?: string;
  tags?: string[];
  leadHealth?: 'HEALTHY' | 'NEEDS ATTENTION' | 'AT RISK';
  dealValue?: number;
  expectedClosureDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = 'Call' | 'Meeting' | 'Email' | 'WhatsApp' | 'Note';
export type ActivityChannel = ActivityType;

export interface Activity {
  id?: string;
  organizationId: string;
  businessId: string;
  businessName?: string;
  userId?: string;
  userName?: string;
  type: ActivityType;
  channel?: ActivityChannel;
  notes: string; // Remarks
  outcome?: string; // e.g., Interested, Replied, Demo Requested, No Response, Quotation Sent
  followUpDate?: string; // Next follow-up date YYYY-MM-DD
  nextAction?: string; // Next action
  activityDate: string;
  createdAt: string;
}

export interface ImportValidationResult {
  valid: Omit<Business, 'id'>[];
  duplicates: { record: Omit<Business, 'id'>; reason: string }[];
  invalid: { row: number; record: Record<string, any>; reason: string }[];
}

export interface KPI {
  id: string;
  organizationId: string;
  name: string;
  unit: 'Currency' | 'Number' | 'Percentage' | 'Units' | 'Custom';
  kpiType?: 'system' | 'custom';
  active: boolean;
  createdAt: string;
}

export interface SalesTarget {
  id: string;
  organizationId: string;
  salespersonUid: string;
  salespersonName: string;
  kpiId: string;
  kpiName: string;
  period: string; // e.g. "2026-08" for August 2026
  targetValue: number;
  managerComment?: string;
  createdAt: string;
}

export interface AchievementEntry {
  id: string;
  organizationId: string;
  salespersonUid: string;
  salespersonName: string;
  kpiId: string;
  kpiName: string;
  value: number;
  date: string; // YYYY-MM-DD
  customerClient?: string;
  product?: string;
  supportingReference?: string;
  notes?: string;
  createdAt: string;
}

export interface TeamReview {
  id?: string;
  organizationId: string;
  salespersonUid: string;
  salespersonName: string;
  kpiId: string;
  kpiName: string;
  target: number;
  achievement: number;
  gap: number;
  completionPercentage: number;
  status: 'ON TRACK' | 'NEEDS ATTENTION' | 'BELOW TARGET';
  reason: string;
  managerComment: string;
  actionPlan: string;
  reviewDate: string; // YYYY-MM-DD
  nextReviewDate: string; // YYYY-MM-DD
  reviewStatus: 'Open' | 'Monitoring' | 'Improved' | 'Closed';
  priority?: 'Normal' | 'High' | 'Medium' | 'Low';
  supportRequired?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingChannel {
  id?: string;
  organizationId: string;
  name: string;
  category: string;
  purpose: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingSOP {
  id?: string;
  organizationId: string;
  channelId: string;
  activity: string;
  frequency: string;
  target: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingActivity {
  id?: string;
  organizationId: string;
  channelId: string;
  sopId: string;
  date: string; // YYYY-MM-DD
  activity: string;
  target: number;
  actual: number;
  result: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface MarketingInsight {
  id?: string;
  organizationId: string;
  channelId: string;
  period?: string;
  decision: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  date?: string;
  targetDate?: string;
  manager?: string;
}




