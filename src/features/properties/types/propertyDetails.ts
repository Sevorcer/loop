export interface PropertyEquipmentItem {
  id: string;
  name: string;
  kind: string;
  status: string;
  serial: string;
  installDate: string;
}

export interface PropertyJobItem {
  id: string;
  title: string;
  status: string;
  scheduledFor: string;
  crew: string;
}

export interface PropertyTimelineEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  icon: "property" | "install" | "service";
}

export interface PropertyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  preference: string;
}

export interface PropertyWarrantyItem {
  id: string;
  title: string;
  description: string;
}

export interface PropertyDocumentItem {
  id: string;
  title: string;
  category: string;
  uploadedAt: string;
  status: "Ready" | "Pending Review" | "Missing";
}

export interface PropertyPhotoItem {
  id: string;
  title: string;
  category: string;
  capturedAt: string;
  status: "Complete" | "Required" | "Flagged";
}

export interface PropertyDetails {
  propertyId: string;
  beforeYouGoItems: string[];
  homeIntelligenceItems: string[];
  equipment: PropertyEquipmentItem[];
  jobs: PropertyJobItem[];
  timeline: PropertyTimelineEvent[];
  contacts: PropertyContact[];
  warranty: PropertyWarrantyItem[];
  notes: string[];
  documents: PropertyDocumentItem[];
  photos: PropertyPhotoItem[];
}