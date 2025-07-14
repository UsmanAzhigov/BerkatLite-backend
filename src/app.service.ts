import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ParserService } from './parser.service';
import { PrismaService } from './prisma.service';
import { AdvertDetails } from './@types/product.types';

@Injectable()
export class AppService {
  constructor(
    private readonly parserService: ParserService,
    private readonly prisma: PrismaService,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }

  @Cron('*/20 * * * * *')
  async saveLastAdvertUrl() {
    try {
      const link = await this.parserService.getLastAdvertUrl();

      await this.prisma.queueLink.create({
        data: {
          link,
        },
      });
    } catch (_) {
      console.log('Объявление уже существует');
    }
  }

  async parseLastAdvert(): Promise<AdvertDetails | undefined> {
    const link = await this.prisma.queueLink.findFirst({
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!link) {
      console.log('Ссылок нет');
      return;
    }

    const details = await this.parserService.getOneAdvertDetails(link.link);

    return details;
  }
}
