import { JobsScreen } from '@/features/jobs'

type SearchParamValue = string | string[] | undefined;

interface JobsPageProps {
  searchParams?: Promise<Record<string, SearchParamValue>>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  return <JobsScreen initialSearchParams={resolvedSearchParams} />
}
