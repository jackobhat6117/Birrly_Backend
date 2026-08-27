import { PAGINATION } from '@/shared/constants/app';

export type PaginationQuery = {
  page?: number;
  pageSize?: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function normalizePagination(query: PaginationQuery): { skip: number; take: number; page: number; pageSize: number } {
  const page = Math.max(1, query.page ?? PAGINATION.defaultPage);
  const pageSize = Math.min(
    PAGINATION.maxPageSize,
    Math.max(1, query.pageSize ?? PAGINATION.defaultPageSize),
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 0,
  };
}
