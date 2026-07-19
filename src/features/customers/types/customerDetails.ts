export interface CustomerPropertyItem {
  id: string;
  name: string;
  address: string;
  city: string;
  status: string;
  primarySystem: string;
}

export interface CustomerJobItem {
  id: string;
  title: string;
  status: string;
  scheduledFor: string;
  propertyName: string;
}

export interface CustomerContactItem {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  preference: string;
}

export interface CustomerTimelineItem {
  id: string;
  title: string;
  date: string;
  description: string;
}

export interface CustomerNoteItem {
  id: string;
  body: string;
}

export interface CustomerDetails {
  customerId: string;
  accountSummary: string[];
  properties: CustomerPropertyItem[];
  jobs: CustomerJobItem[];
  contacts: CustomerContactItem[];
  timeline: CustomerTimelineItem[];
  notes: CustomerNoteItem[];
}