import {
  jobsRepository,
  type JobsListQuery,
  type JobsRepository,
  type JobWriteInput,
} from "@/services/repositories/jobsRepository";

export function createJobsService(repository: JobsRepository = jobsRepository) {
  return {
    list(query?: JobsListQuery) {
      return repository.list(query);
    },
    getById(id: string) {
      return repository.getById(id);
    },
    create(input: JobWriteInput) {
      return repository.create(input);
    },
    update(id: string, input: JobWriteInput) {
      return repository.update(id, input);
    },
    remove(id: string) {
      return repository.delete(id);
    },
  };
}
