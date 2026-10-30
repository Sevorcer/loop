export interface JobNote {
  id: string;
  jobId: string;
  body: string;
  authorId: string | null;
  authorName: string;
  authorRole: string;
  createdAt: string;
}
