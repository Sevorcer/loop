export interface JobCallbackLink {
  id: string;
  jobNumber: string;
  title: string;
}

export interface JobCallbackContext {
  original: JobCallbackLink | null;
  reason: string | null;
  returnVisits: Array<JobCallbackLink & { reason: string }>;
}

export const EMPTY_JOB_CALLBACK_CONTEXT: JobCallbackContext = {
  original: null,
  reason: null,
  returnVisits: [],
};
