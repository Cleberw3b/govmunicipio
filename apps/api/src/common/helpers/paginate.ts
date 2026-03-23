import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { IPaginatedResponse, IPaginationMeta } from '@govmunicipio/shared';

export async function paginate<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  page: number = 1,
  limit: number = 20,
): Promise<IPaginatedResponse<T>> {
  const total = await queryBuilder.getCount();
  const data = await queryBuilder
    .skip((page - 1) * limit)
    .take(limit)
    .getMany();

  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  const meta: IPaginationMeta = {
    total,
    page,
    limit,
    totalPages,
    hasMore,
  };

  return {
    data,
    meta,
  };
}
