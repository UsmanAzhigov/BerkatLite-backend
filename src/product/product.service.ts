import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { TogetherAIService } from '../together/togetherai.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Prisma } from 'generated/prisma';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  private readonly categories = ['avto', 'nedvizhimost'];
  private allLinks = new Set<string>();
  private processedLinks = new Set<string>();
  private readonly batchSize = 3;

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
      ...(category && { category: { equals: category, mode: 'insensitive' } }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
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

  /**
   * Получает все ссылки, затем подключается ИИ и так каждые 5 минут
   */
  async onModuleInit() {
    await this.updateLinksAndProcessBatch();
    setInterval(
      () => {
        this.updateLinksAndProcessBatch();
        this.processNextBatch();
      },
      60 * 60 * 1000,
    );
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private async updateLinksAndProcessBatch() {
    try {
      await this.fetchAllCategoryLinks();

      const shuffled = this.shuffleArray(Array.from(this.allLinks));
      this.allLinks = new Set(shuffled);
    } catch (error) {
      this.logger.error(
        'Ошибка при обновлении ссылок и обработке батча',
        error,
      );
    }
  }

  /**
   * Загружает все ссылки объявлений из всех категорий и добавляет их в общий список.
   */
  private async fetchAllCategoryLinks() {
    const linkArrays = await Promise.all(
      this.categories.map((cat) => this.parseCategoryLinks(cat)),
    );

    const combined = linkArrays.flat();
    combined.forEach((link) => this.allLinks.add(link));
  }

  /**
   * Парсит страницу категории и возвращает массив ссылок на объявления.
   */
  private async parseCategoryLinks(category: string) {
    const url = `https://berkat.ru/${category}/`;
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      const rawLinks: string[] = [];

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

      const uniqueLinks = [...new Set(rawLinks)];

      const filteredLinks: string[] = [];

      for (const link of uniqueLinks) {
        try {
          const html = await this.fetchAdPage(link);
          const $page = cheerio.load(html);
          const text = $page('body').text().replace(/\s+/g, ' ').toLowerCase();

          if (
            category === 'avto' &&
            /услуги|вмятины|покраска|ремонт|эвакуатор|диагностика|мастер|автопрокат|удаление|установка|тонировка/i.test(
              text,
            )
          ) {
            continue;
          }

          filteredLinks.push(link);
        } catch (err) {
          this.logger.warn(`Ошибка проверки ссылки ${link}: ${err.message}`);
        }
      }

      return filteredLinks;
    } catch (err) {
      this.logger.warn(`Ошибка загрузки категории ${category}: ${err.message}`);
      return [];
    }
  }

  /**
   * Обрабатывает следующий батч необработанных ссылок: парсит, извлекает и сохраняет продукты.
   */
  private async processNextBatch() {
    const unprocessed = Array.from(this.allLinks).filter(
      (link) => !this.processedLinks.has(link),
    );
    const batch = unprocessed.slice(0, this.batchSize);
    const groupSize = 3;

    for (let i = 0; i < batch.length; i += groupSize) {
      const group = batch.slice(i, i + groupSize);
      const htmlBlocks: { html: string; url: string }[] = [];

      for (const link of group) {
        try {
          const html = await this.fetchAdPage(link);
          htmlBlocks.push({ html, url: link });
        } catch (err) {
          this.logger.warn(`Ошибка при получении HTML ${link}: ${err.message}`);
          this.processedLinks.add(link);
        }
      }

      if (htmlBlocks.length === 0) continue;

      try {
        const products = await this.extractProductsFromMultipleHtml(htmlBlocks);
        for (let j = 0; j < products.length; j++) {
          const product = products[j];
          await this.saveOrUpdateProduct(product);
          this.processedLinks.add(group[j]);
        }
      } catch (err) {
        this.logger.warn(
          'Ошибка парсинга JSON от ИИ (групповой): ' + err.message,
        );
      }
    }
  }

  /**
   * Загружает HTML-страницу объявления по ссылке.
   */
  private async fetchAdPage(url: string) {
    const response = await axios.get(url, { responseType: 'text' });

    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error(`Неподдерживаемый тип содержимого: ${contentType}`);
    }

    return response.data;
  }

  /**
   * Извлекает данные продукта из HTML-страницы с помощью ИИ.
   */
  async extractProductsFromMultipleHtml(
    htmlBlocks: { html: string; url: string }[],
  ) {
    const htmlList = htmlBlocks
      .map((block, i) => {
        const $ = cheerio.load(block.html);
        const cleaned = $('body').html()?.replace(/\s+/g, ' ').trim() || '';
        return `Объявление ${i + 1} (${block.url}):\n${cleaned}`;
      })
      .join('\n\n');

    const prompt = `
Ты — парсер объявлений с сайта https://berkat.ru.
На вход ты получаешь HTML-текст объявления. Твоя задача — вернуть JSON с товаром в следующем формате:

{
  "title": "string", (Генерируй новый title, без мусора, коротко и понятно)
  "description": "string",(Генерируй новый description, без мусора, коротко и понятно)
  "price": number,
  "images": string[], (В начало ссылки изображения вставь https://berkat.ru)
  "category": "Транспорт" | "Недвижимость",
  "popular": number,
  "phone": string[],
  "properties": { "name": string, "text": string }[],
  "city": "string"
}

Ответь только валидным JSON, без пояснений, текста и markdown.

Вот HTML объявления:
${htmlList}
    `;

    const aiResponse = await this.togetherAI.chat(prompt);

    try {
      const jsonStart = aiResponse.indexOf('[');
      const jsonEnd = aiResponse.lastIndexOf(']');
      const jsonText = aiResponse.slice(jsonStart, jsonEnd + 1);
      const products = JSON.parse(jsonText);
      return products;
    } catch (err) {
      this.logger.warn('Ошибка при парсинге JSON массива от ИИ');
      throw new Error('Невалидный JSON от ИИ (массив)');
    }
  }

  /**
   * Сохраняет новый продукт или обновляет существующий по совпадению названия.
   */
  private async saveOrUpdateProduct(product: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { title: product.title },
    });

    if (existing) {
      await this.prisma.product.update({
        where: { id: existing.id },
        data: product,
      });
    } else {
      await this.prisma.product.create({ data: product });
    }
  }
}
