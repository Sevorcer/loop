import {
  customersRepository,
  type CustomerWriteInput,
  type CustomersListQuery,
  type CustomersRepository,
} from "@/services/repositories/customersRepository";

export function createCustomersService(
  repository: CustomersRepository = customersRepository
) {
  return {
    list(query?: CustomersListQuery) {
      return repository.list(query);
    },
    getById(id: string) {
      return repository.getById(id);
    },
    create(input: CustomerWriteInput) {
      return repository.create(input);
    },
    update(id: string, input: CustomerWriteInput) {
      return repository.update(id, input);
    },
    remove(id: string) {
      return repository.delete(id);
    },
  };
}
