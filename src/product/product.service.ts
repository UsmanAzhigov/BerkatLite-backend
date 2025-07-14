import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { TogetherAIService } from '../together/togetherai.service';
import { Prisma } from 'generated/prisma';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ProductService {
  private categories = [
    'https://berkat.ru/avto',
    'https://berkat.ru/nedvizhimost',
  ];
  private allLinks: string[] = [];
  private processedLinks = new Set<string>();
  constructor(
    private prisma: PrismaService,
    private togetherAI: TogetherAIService,
  ) {}

  async findAll(params: {
    category?: string;
    page?: number;
    take?: number | string;
    search?: string;
    sortBy?: 'price' | 'createdAt' | 'popular';
    sortOrder?: 'asc' | 'desc';
    priceFrom?: number;
    priceTo?: number;
    city?: string;
  }) {
    const {
      category,
      page = 1,
      take = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'asc',
      priceFrom,
      priceTo,
      city,
    } = params;

    const takeNumber = parseInt(take as string, 10);
    const skip = (page - 1) * takeNumber;
    const where: Prisma.ProductWhereInput = {
      ...(category && { category: { equals: category } }),
      ...(search && {
        title: {
          contains: search,
          mode: 'insensitive',
        },
      }),
      ...(city && { city: { equals: city, mode: 'insensitive' } }),
      price: {
        ...(priceFrom !== undefined ? { gte: Number(priceFrom) } : {}),
        ...(priceTo !== undefined ? { lte: Number(priceTo) } : {}),
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: takeNumber,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        take: takeNumber,
        totalPages: Math.ceil(total / takeNumber),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new Error(`Product with ID ${id} not found`);

    return this.prisma.product.update({
      where: { id },
      data: { popular: { increment: 1 } },
    });
  }

  async fetchWithRetry(
    url: string,
    retries = 3,
    delayMs = 1000,
  ): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          },
          timeout: 5000,
        });
        return response.data;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
    throw new Error('Unreachable code');
  }

  async parsePage(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const title = $('h1')
      .text()
      .replace(
        'Написать сообщение\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\tПоднять в списке\n\t\t\t\t\t\t\n\t\t\t\t\t\n\t\t\t\t\t\t\n\t\t\t\t\n\t\t\t\t\n\t\t\t\t',
        '',
      )
      .trim();
    const $desc = $('.board_item_desc').clone();
    $desc.find('.clearboth, .board_item_info, .board_item_info_gray').remove();

    let description = $desc
      .text()
      .replace(/\t+/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();

    description = description.replace(/\n/g, ' ');

    const images: string[] = [];

    $('.fotorama img').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        const fullUrl = src.startsWith('http')
          ? src
          : `https://berkat.ru${src}`;
        if (!images.includes(fullUrl)) {
          images.push(fullUrl);
        }
      }
    });

    const phone = $('[href^="tel:"]').attr('href')?.replace('tel:', '') ?? null;
    const priceText = $('.board_item_price span')
      .first()
      .text()
      .replace(/\s/g, '');
    const price = priceText
      ? parseInt(priceText.replace(/[^\d]/g, ''), 10)
      : null;
    const category = $('#breadcrumbs [itemprop="title"]').first().text().trim();
    const popular = parseInt(
      $('.board_item_hits').text().replace('Просмотры: ', ''),
    );
    const city = $('.board_item_city').text().trim() || null;
    const createdAt = $('.board_item_date time').first().text().trim();

    const properties: { name: string; text: string }[] = [];

    $('.content_item_props table tr').each((_, el) => {
      const name = $(el).find('td.title').text().trim();
      const text = $(el).find('td.value').text().trim();

      if (name && text) {
        properties.push({ name, text });
      }
    });

    return {
      url,
      title,
      description,
      images,
      phone,
      price,
      category,
      popular,
      city,
      createdAt,
      properties,
    };
  }

  async parseGetLinks(link: string, categoryName: 'avto' | 'nedvizhimost') {
    const rawLinks: string[] = [];
    try {
      const data = await this.fetchWithRetry(link);

      const $ = cheerio.load(data);

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (
          href &&
          /\/\d+-/.test(href) &&
          !/\.(jpg|jpeg|png|gif|webp|pdf)$/i.test(href)
        ) {
          const fullLink = href.startsWith('http')
            ? href
            : `https://berkat.ru${href}`;
          rawLinks.push(fullLink);
        }
      });
    } catch (error) {
      console.error(`Failed to fetch links from ${link}:`, error);
      return [];
    }

    const uniqueLinks = [...new Set(rawLinks)];
    const filteredLinks: string[] = [];

    for (const link of uniqueLinks) {
      try {
        const data = await this.fetchWithRetry(link);
        const $page = cheerio.load(data);
        const text = $page('.board_item')
          .text()
          .replace(/\s+/g, ' ')
          .toLowerCase();

        if (
          categoryName === 'avto' &&
          /услуги|вмятины|покраска|ремонт|эвакуатор|диагностика|мастер|удаление|установка|тонировка/i.test(
            text,
          )
        ) {
          continue;
        }

        filteredLinks.push(link);
      } catch (err) {
        console.log(`Error processing link ${link}:`, err.message);
      }
    }

    return filteredLinks;
  }

  async generateTitleAndDescription(data: {
    title: string;
    description: string;
  }) {
    const prompt = `Сгенерируй новый заголовок и описание, коротко и ясно title: ${data.title}, description: ${data.description}`;

    try {
      const result = await this.togetherAI.chat(prompt);
      return result;
    } catch (err) {
      console.error('Ошибка генерации ИИ:', err);
      return null;
    }
  }

  @Cron('*/60 * * * *')
  async processBatch() {
    const freshLinks: string[] = [];
    for (const url of this.categories) {
      const categoryName = url.includes('avto') ? 'avto' : 'nedvizhimost';
      try {
        const links = await this.parseGetLinks(url, categoryName);
        freshLinks.push(...links);
      } catch (e) {
        console.error(
          `Ошибка при парсинге ссылок категории ${categoryName}:`,
          e,
        );
      }
    }

    this.allLinks = this.allLinks.filter((link) => freshLinks.includes(link));

    for (const link of freshLinks) {
      if (!this.allLinks.includes(link)) {
        this.allLinks.push(link);
        this.processedLinks.delete(link);
      }
    }

    const batch = this.allLinks
      .filter((link) => !this.processedLinks.has(link))
      .slice(0, 2);

    for (const link of batch) {
      try {
        const data = await this.parsePage(link);

        const ai = await this.generateTitleAndDescription({
          title: data.title,
          description: data.description,
        });

        const existing = await this.prisma.product.findFirst({
          where: { title: data.title },
        });

        const finalTitle = ai?.title ?? data.title ?? '';
        const finalDescription = ai?.description ?? data.description ?? '';

        const productPayload = {
          title: finalTitle || '',
          description: finalDescription || '',
          price:
            typeof data.price === 'number' && !isNaN(data.price)
              ? data.price
              : 0,
          images: data.images || [],
          category: data.category || '',
          popular: data.popular ? 1 : 0,
          city: data.city || '',
          phone: data.phone || '',
          properties: data.properties || {},
          createdAt: data.createdAt ? String(data.createdAt) : '',
        };

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: productPayload,
          });
        } else {
          await this.prisma.product.create({
            data: productPayload,
          });
        }

        this.processedLinks.add(link);
      } catch (err) {
        console.error(`Ошибка обработки ${link}:`, err);
      }
    }
  }
}
