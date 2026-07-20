import {
  documentsRepository,
  type DocumentsListQuery,
  type DocumentsRepository,
  type PortalDocumentAccess,
} from "@/services/repositories/documentsRepository";

export function createDocumentsService(
  repository: DocumentsRepository = documentsRepository
) {
  return {
    list(query?: DocumentsListQuery) {
      return repository.list(query);
    },
    getById(id: string) {
      return repository.getById(id);
    },
    create(input: Partial<PortalDocumentAccess>) {
      return repository.create(input);
    },
    update(id: string, input: Partial<PortalDocumentAccess>) {
      return repository.update(id, input);
    },
    remove(id: string) {
      return repository.delete(id);
    },
  };
}
