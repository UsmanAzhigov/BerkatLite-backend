import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { TogetherAIService } from '../together/togetherai.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  private readonly categories = ['avto', 'nedvizhimost'];
  private allLinks = new Set<string>();
  private processedLinks = new Set<string>();
  private readonly batchSize = 10;

  constructor(
    private prisma: PrismaService,
    private togetherAI: TogetherAIService,
  ) {}

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

  /**
   * Получает все ссылки, затем подключается ИИ и так каждые 5 минут
   */
  async onModuleInit() {
    await this.updateLinksAndProcessBatch();
    setInterval(() => this.updateLinksAndProcessBatch(), 5 * 60 * 1000);
  }

  private async updateLinksAndProcessBatch() {
    try {
      await this.fetchAllCategoryLinks();
      await this.processNextBatch();
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
      const links: string[] = [];

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && /\/\d+-/.test(href)) {
          const fullLink = href.startsWith('http')
            ? href
            : `https://berkat.ru${href}`;
          links.push(fullLink);
        }
      });

      return links;
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

    for (const link of batch) {
      try {
        const html = await this.fetchAdPage(link);
        const product = await this.extractProductFromHtml(html);
        await this.saveOrUpdateProduct(product);
        this.processedLinks.add(link);
      } catch (err) {
        this.logger.warn(
          `Ошибка при обработке объявления ${link}: ${err.message}`,
        );
      }
    }
  }

  /**
   * Загружает HTML-страницу объявления по ссылке.
   */
  private async fetchAdPage(url: string) {
    const { data } = await axios.get(url);
    return data;
  }

  /**
   * Извлекает данные продукта из HTML-страницы с помощью ИИ.
   */
  private async extractProductFromHtml(html: string) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    const images: string[] = [];
    $('img[src]').each((_, el) => {
      let src = $(el).attr('src');
      if (src && !src.startsWith('http')) {
        src = `https://berkat.ru${src}`;
      }
      if (src) images.push(src);
    });

    if (/эвакуатор|услуги|ремонт|вмятины|покраска/i.test(text)) {
      this.logger.warn(`Пропускаю объявление: услуги, а не товар`);
      return;
    }

    const prompt = `
Ты — фильтр объявлений с сайта https://berkat.ru.
Твоя задача — вернуть ТОЛЬКО товары (не услуги, не аренду, не рекламу) в JSON:
{
  title: string,
  price: number,
  images: string[],
  category: "Транспорт" | "Недвижимость",
  popular: number,
  description: string,
  phone: string[],
  properties: { name: string, text: string }[],
  city: string
}
Если это не товар — ничего не возвращай.
Вот текст:
${text}
`;

    const aiResponse = await this.togetherAI.chat(prompt);

    const cleaned = aiResponse
      .trim()
      .replace(/^```json\s*/, '')
      .replace(/```$/, '')
      .replace(/^json\s*/, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      this.logger.warn('Не удалось распарсить JSON от ИИ:', cleaned);
      throw new Error('Неверный JSON от ИИ');
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
