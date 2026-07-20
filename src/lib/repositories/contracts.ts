export type SortDirection = "asc" | "desc";

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface RepositorySort<Field extends string = string> {
  field: Field;
  direction: SortDirection;
}

export type RepositoryFilterValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type RepositoryFilters<Field extends string = string> = Partial<
  Record<Field, RepositoryFilterValue>
>;

export interface RepositoryQuery<
  FilterField extends string = string,
  SortField extends string = string,
> {
  pagination?: Partial<PaginationParams>;
  filters?: RepositoryFilters<FilterField>;
  sort?: Array<RepositorySort<SortField>>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RepositoryError<Code extends string = string> {
  code: Code;
  message: string;
  details?: Record<string, unknown>;
}

export type RepositoryResult<T, Code extends string = string> =
  | { ok: true; data: T }
  | { ok: false; error: RepositoryError<Code> };

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function normalizePagination(
  pagination?: Partial<PaginationParams>
): PaginationParams {
  const page = Math.max(DEFAULT_PAGE, Math.floor(pagination?.page ?? DEFAULT_PAGE));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(pagination?.pageSize ?? DEFAULT_PAGE_SIZE))
  );

  return { page, pageSize };
}

export function paginateItems<T>(
  items: T[],
  pagination?: Partial<PaginationParams>
): PaginatedResult<T> {
  const normalized = normalizePagination(pagination);
  const startIndex = (normalized.page - 1) * normalized.pageSize;

  return {
    items: items.slice(startIndex, startIndex + normalized.pageSize),
    total: items.length,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b));
}

export function applySort<T, Field extends keyof T & string>(
  items: T[],
  sort?: Array<RepositorySort<Field>>
): T[] {
  if (!sort || sort.length === 0) return items;

  const sorted = [...items];

  sorted.sort((left, right) => {
    for (const { field, direction } of sort) {
      const comparison = compareValues(left[field], right[field]);
      if (comparison !== 0) {
        return direction === "asc" ? comparison : -comparison;
      }
    }

    return 0;
  });

  return sorted;
}

export function isFilterMatch<T, Field extends keyof T & string>(
  entity: T,
  filters?: RepositoryFilters<Field>
): boolean {
  if (!filters) return true;

  return (Object.keys(filters) as Field[]).every((field) => {
    const value = filters[field];
    if (value === undefined || value === null) return true;

    const entityValue = entity[field];

    if (Array.isArray(value)) {
      return value.includes(entityValue as string | number | boolean);
    }

    return entityValue === value;
  });
}

export interface CrudRepository<
  Entity,
  CreateInput,
  UpdateInput,
  FilterField extends string,
  SortField extends string,
  ErrorCode extends string,
> {
  list(
    query?: RepositoryQuery<FilterField, SortField>
  ): Promise<RepositoryResult<PaginatedResult<Entity>, ErrorCode>>;
  getById(id: string): Promise<RepositoryResult<Entity, ErrorCode>>;
  create(input: CreateInput): Promise<RepositoryResult<Entity, ErrorCode>>;
  update(id: string, input: UpdateInput): Promise<RepositoryResult<Entity, ErrorCode>>;
  delete(id: string): Promise<RepositoryResult<{ id: string }, ErrorCode>>;
}
