import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ParserService } from './parser.service';
import { PrismaService } from './prisma.service';
import {
  AdvertDetails,
  GetAllParams,
  PaginationMeta,
} from './@types/product.types';
import { ProductService } from './product.service';

@Injectable()
export class AppService {
  constructor(
    private readonly parserService: ParserService,
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  getAll(
    query: GetAllParams,
  ): Promise<{ items: AdvertDetails[]; meta: PaginationMeta }> {
    return this.productService.getAll(query);
  }

  getOne(id: string): Promise<AdvertDetails> {
    return this.productService.getOne(id);
  }

  @Cron('*/20 * * * * *')
  async saveLastAdvertUrl() {
    try {
      const link = await this.parserService.getLastAdvertAutoUrl();

      await this.prisma.queueLink.create({
        data: {
          link,
        },
      });

      console.log(link);
    } catch (_) {
      console.log('[Транспорт] Объявление уже существует');
    }
  }

  @Cron('10/20 * * * * *')
  async saveLastRealtyAdvertUrl() {
    try {
      const link = await this.parserService.getLastAdvertRealtyUrl();

      await this.prisma.queueLink.create({
        data: {
          link,
        },
      });

      console.log(link);
    } catch (_) {
      console.log('[Недвижимость] Объявление уже существует');
    }
  }

  @Cron('*/1 * * * *')
  async parseLastAdvert(): Promise<AdvertDetails | undefined> {
    const link = await this.prisma.queueLink.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!link) {
      console.log('Ссылок нет');
      return;
    }

    try {
      const details = await this.parserService.getOneAdvertDetails(link.link);
      const product = await this.productService.createProduct(details);

      await this.prisma.queueLink.delete({ where: { id: link.id } });
    } catch (error) {
      console.error('Ошибка при создании объявления:', error.message);

      await this.prisma.queueLink.delete({ where: { id: link.id } });

      return;
    }
  }
}
