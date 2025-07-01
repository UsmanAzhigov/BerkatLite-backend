import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class ProductService {
  private categories = ['avto', 'nedvizhimost'];
  private allLinks: string[] = [];

  constructor(private prisma: PrismaService) {}

  async findAll(category?: string) {
    return this.prisma.product.findMany({
      where: category
        ? {
            category: {
              equals: category,
              mode: 'insensitive',
            },
          }
        : {},
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error(`Product with ID ${id} not found`);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        popular: { increment: 1 },
      },
    });

    return updated;
  }

  async searchProducts(query: string) {
    return this.prisma.product.findMany({
      where: {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
    });
  }

  async findByFilter(priceFrom?: number, priceTo?: number, city?: string) {
    return this.prisma.product.findMany({
      where: {
        price: {
          gte: priceFrom || undefined,
          lte: priceTo || undefined,
        },
        city: {
          equals: city,
          mode: 'insensitive',
        },
      },
    });
  }

  async findBySort(
    sort: 'asc' | 'desc',
    sortBy: 'price' | 'createdAt' | 'popular',
  ) {
    return this.prisma.product.findMany({
      orderBy: {
        [sortBy]: sort,
      },
    });
  }

  getAllLinks(): string[] {
    return this.allLinks;
  }

  async onModuleInit() {
    await this.fetchAllCategories();

    setInterval(
      () => {
        this.fetchAllCategories();
      },
      5 * 60 * 1000,
    );
  }

  private async fetchAllCategories() {
    let combinedLinks: string[] = [];

    for (const category of this.categories) {
      const links = await this.parseCategoryLinks(category);
      console.log(`[${category.toUpperCase()}] Собрано ${links.length} ссылок`);
      combinedLinks = combinedLinks.concat(links);
    }

    this.allLinks = Array.from(new Set(combinedLinks));
  }

  private async parseCategoryLinks(category: string): Promise<string[]> {
    const url = `https://berkat.ru/${category}/`;
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      const links: string[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href');
        const classAttr = $(el).attr('class') || '';

        const isAd = /promo|ad|advertisement/.test(classAttr);
        const isValidLink = href && /\/\d+-/.test(href);

        const fullLink = href?.startsWith('/')
          ? `https://berkat.ru${href}`
          : href;

        if (isValidLink && !isAd && fullLink) {
          links.push(fullLink);
        }
      });

      return links;
    } catch (error) {
      console.error(`Ошибка парсинга ${url}:`, error);
      return [];
    }
  }
}
