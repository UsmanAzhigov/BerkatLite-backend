import { AdvertTransactionProps } from 'src/@types/product.types';
import { PrismaService } from 'src/prisma.service';

export async function advertTransaction({
  where,
  skip,
  take,
  sortBy,
  sortOrder,
  prisma,
}: AdvertTransactionProps & { prisma: PrismaService }): Promise<{
  rawItems: any;
  total: number;
}> {
  const [rawItems, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.product.count({ where }),
  ]);

  return { rawItems, total };
}
