export interface IPaginationQuery {
  page?: number;
  limit?: number;
  skip?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface IPaginatedResponse<T> {
  data: T[];
  meta: IPaginationMeta;
}
