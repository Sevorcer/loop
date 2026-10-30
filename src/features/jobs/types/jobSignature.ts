export interface JobSignature {
  id: string;
  jobId: string;
  signerName: string;
  capturedByName: string;
  capturedByRole: string;
  capturedAt: string;
  previewUrl: string | null;
}
