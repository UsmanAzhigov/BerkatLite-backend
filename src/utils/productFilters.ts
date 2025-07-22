import { Prisma } from 'generated/prisma';
import { ProductFiltersParams } from 'src/@types/product.types';

export function productFilters(
  params: ProductFiltersParams,
): Prisma.ProductWhereInput {
  const { categoryId, cityId, search, priceFrom, priceTo } = params;

  const where: Prisma.ProductWhereInput = {};

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (cityId) {
    where.cityId = cityId;
  }

  // if (search) {
  //   where.title = { contains: search, mode: 'insensitive' };
  // }

  if (priceFrom !== undefined || priceTo !== undefined) {
    where.price = {};
    if (priceFrom !== undefined) {
      where.price.gte = priceFrom;
    }
    if (priceTo !== undefined) {
      where.price.lte = priceTo;
    }
  }

  return where;
}
