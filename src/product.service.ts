import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import {
  AdvertDetails,
  AdvertProperty,
  GetAllParams,
} from 'src/@types/product.types';
import { PrismaService } from 'src/prisma.service';
import { productFilters } from './utils/productFilters';
import { pagination } from './utils/pagination';
import { advertMapper } from './utils/advert.mapper';
import { advertTransaction } from './utils/advertTransaction';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(params: GetAllParams) {
    const { sortBy = 'createdAt', sortOrder = 'asc', ...restParams } = params;

    const where = productFilters(restParams);
    const { take, skip, currentPage } = pagination(
      restParams.page,
      restParams.take,
    );

    const { rawItems, total } = await advertTransaction({
      prisma: this.prisma,
      where,
      skip,
      take,
      sortBy,
      sortOrder,
    });

    const { items } = advertMapper(rawItems);

    return {
      items,
      meta: {
        total,
        page: currentPage,
        take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getOne(id: string): Promise<AdvertDetails> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new Error(`Объявление ${id} не найдено`);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    return {
      ...updated,
      properties: (updated.properties as unknown as AdvertProperty[]) ?? [],
    };
  }

  async createProduct(data: AdvertDetails): Promise<AdvertDetails | undefined> {
    try {
      const product = await this.prisma.product.create({
        data: {
          ...data,
          phone: data.phone ?? '',
          price: data.price ?? 0,
          properties: (data.properties ??
            []) as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        ...product,
        properties: product.properties as unknown as AdvertProperty[],
      };
    } catch (_) {
      console.log('Такое объявление уже создано');
    }
  }
}
