import {
  applySort,
  isFilterMatch,
  paginateItems,
  type CrudRepository,
  type RepositoryQuery,
} from "@/lib/repositories/contracts";

export type DocumentsRepositoryErrorCode = "NOT_FOUND" | "INVALID_INPUT";

export interface PortalDocumentAccess {
  id?: string;
  projectId?: string;
  documentId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export type DocumentsFilterField = "projectId";

export type DocumentsSortField = "projectId" | "createdAt";

export type DocumentsListQuery = RepositoryQuery<
  DocumentsFilterField,
  DocumentsSortField
>;

const mockDocuments: PortalDocumentAccess[] = [];

export type DocumentsRepository = CrudRepository<
  PortalDocumentAccess,
  Partial<PortalDocumentAccess>,
  Partial<PortalDocumentAccess>,
  DocumentsFilterField,
  DocumentsSortField,
  DocumentsRepositoryErrorCode
>;

export const documentsRepository: DocumentsRepository = {
  async list(query) {
    const filtered = mockDocuments.filter((document) =>
      isFilterMatch(document, query?.filters)
    );
    const sorted = applySort(filtered, query?.sort);

    return {
      ok: true,
      data: paginateItems(sorted, query?.pagination),
    };
  },

  async getById(id) {
    const document = mockDocuments.find((item) => item.id === id);

    if (!document) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Document '${id}' not found.`,
        },
      };
    }

    return { ok: true, data: document };
  },

  async create(input) {
    return {
      ok: true,
      data: {
        ...input,
        id: input.id ?? crypto.randomUUID(),
        createdAt: input.createdAt ?? new Date().toISOString(),
      },
    };
  },

  async update(id, input) {
    const existing = mockDocuments.find((item) => item.id === id);
    if (!existing) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Document '${id}' not found.`,
        },
      };
    }

    return {
      ok: true,
      data: { ...existing, ...input, id },
    };
  },

  async delete(id) {
    return {
      ok: true,
      data: { id },
    };
  },
};
