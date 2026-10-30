import { JobsScreen } from '@/features/jobs'
import { listJobsWithActivity } from '@/services/jobs'

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

interface JobsPageProps {
  searchParams?: Promise<Record<string, SearchParamValue>>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { jobs } = await listJobsWithActivity();
  return <JobsScreen initialSearchParams={resolvedSearchParams} initialJobs={jobs} />
}
