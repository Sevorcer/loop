export interface DailyPlanNote {
  date: string;
  content: string;
  updatedAt: string;
}

export interface DailyPlanStoreValue {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  getNote: (date: string) => string;
  saveNote: (date: string, content: string) => void;
}
