export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  organizationId: string;
  role?: 'Manager' | 'Telecaller' | 'Salesperson';
  active?: boolean;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
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

