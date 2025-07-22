import { Controller, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { GenerateService } from './generate.service';
import { AdvertDetails } from './@types/product.types';
import { PrismaService } from './prisma.service';
import { Cron } from '@nestjs/schedule';
import { ProductService } from './product.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getAll(@Query() query: Record<string, any>) {
    const priceFrom = query.priceFrom ? parseFloat(query.priceFrom) : undefined;
    const priceTo = query.priceTo ? parseFloat(query.priceTo) : undefined;

    return this.appService.getAll({
      ...query,
      priceFrom,
      priceTo,
      page: query.page ? parseInt(query.page, 10) : undefined,
      take: query.take ? parseInt(query.take, 10) : undefined,
    });
  }

  @Get('links')
  async getLinks() {
    await this.appService.saveLastAdvertUrl();
  }

  @Get('advert')
  async getAdvert() {
    await this.appService.parseLastAdvert();
  }

  @Get('cities')
  async getCities() {
    return this.prisma.city.findMany();
  }

  @Get('categories')
  async getCategories() {
    return this.prisma.category.findMany();
  }

  @Get('advert/:id')
  findOne(@Param('id') id: string) {
    return this.appService.getOne(id);
  }
}
