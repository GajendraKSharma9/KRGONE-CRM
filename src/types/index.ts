export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  organizationId: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export type BusinessStatus = 'New' | 'Won' | 'Lost';

export interface Business {
  id?: string;
  organizationId: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  industry: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = 'Call' | 'Meeting' | 'Email' | 'WhatsApp' | 'Note';

export interface Activity {
  id?: string;
  organizationId: string;
  businessId: string;
  businessName?: string;
  type: ActivityType;
  notes: string;
  activityDate: string;
  createdAt: string;
}

export interface ImportValidationResult {
  valid: Omit<Business, 'id'>[];
  duplicates: { record: Omit<Business, 'id'>; reason: string }[];
  invalid: { row: number; record: Record<string, any>; reason: string }[];
}
