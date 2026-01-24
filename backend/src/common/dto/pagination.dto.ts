import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Дефолтный и максимальный limit для защиты от DoS */
export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

/**
 * DTO для пагинации с валидацией limit (max 100).
 * Подключать через @Query() в контроллерах.
 */
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Номер страницы' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'page должен быть не меньше 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    default: PAGINATION_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PAGINATION_MAX_LIMIT,
    description: 'Записей на странице (макс. 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'limit должен быть не меньше 1' })
  @Max(PAGINATION_MAX_LIMIT, { message: `limit не может быть больше ${PAGINATION_MAX_LIMIT}` })
  limit?: number = PAGINATION_DEFAULT_LIMIT;
}

/**
 * Нормализует page/limit из произвольных значений.
 * Использовать, когда Query не использует PaginationDto (например, в сервисах).
 */
export function normalizePagination(
  page?: number | string,
  limit?: number | string,
): { page: number; limit: number } {
  const p = Math.max(1, parseInt(String(page || 1), 10) || 1);
  const l = Math.min(
    PAGINATION_MAX_LIMIT,
    Math.max(1, parseInt(String(limit || PAGINATION_DEFAULT_LIMIT), 10) || PAGINATION_DEFAULT_LIMIT),
  );
  return { page: p, limit: l };
}
