import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { ParserService } from './parser.service';
import { PrismaService } from './prisma.service';
import {
  AdvertDetails,
  GetAllParams,
  PaginationMeta,
} from './@types/product.types';
import { ProductService } from './product.service';
import { GenerateService } from './generate.service';

@Injectable()
export class AppService {
  constructor(
    private readonly parserService: ParserService,
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly generateService: GenerateService,
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
    } catch (_) {
      console.log('[Недвижимость] Объявление уже существует');
    }
  }

  @Cron('*/20 * * * * *')
async parseLastAdvert(): Promise<void> {
  const links = await this.prisma.queueLink.findMany({
    orderBy: { createdAt: 'asc' },
    take: 2,
  });

  if (links.length === 0) {
    console.log('Ссылок нет');
    return;
  }

  for (const link of links) {
    try {
      const details = await this.parserService.getOneAdvertDetails(link.link);

      const generated = await this.generateService.generateAdvert(details);

      if (!generated) {
        console.log('Объявление отклонено ИИ или по типу сделки:', link.link);
        await this.prisma.queueLink.delete({ where: { id: link.id } });
        continue;
      }

      const existing = await this.prisma.product.findUnique({
        where: { sourceUrl: generated.sourceUrl },
      });

      if (existing) {
        console.log('Объявление уже существует:', link.link);
        await this.prisma.queueLink.delete({ where: { id: link.id } });
        continue;
      }

      await this.productService.createProduct(generated);
      await this.prisma.queueLink.delete({ where: { id: link.id } });
    } catch (error) {
      console.error('Ошибка при обработке объявления:', link.link, error.message);
      await this.prisma.queueLink.delete({ where: { id: link.id } });
    }
  }
}
}
