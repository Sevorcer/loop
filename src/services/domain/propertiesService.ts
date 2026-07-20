import {
  type PropertyWriteInput,
  type PropertiesRepository,
  type PropertiesListQuery,
  propertiesRepository,
} from "@/services/repositories/propertiesRepository";

export function createPropertiesService(
  repository: PropertiesRepository = propertiesRepository
) {
  return {
    list(query?: PropertiesListQuery) {
      return repository.list(query);
    },
    getById(id: string) {
      return repository.getById(id);
    },
    create(input: PropertyWriteInput) {
      return repository.create(input);
    },
    update(id: string, input: PropertyWriteInput) {
      return repository.update(id, input);
    },
    remove(id: string) {
      return repository.delete(id);
    },
  };
}
