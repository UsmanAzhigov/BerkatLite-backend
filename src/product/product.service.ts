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
    setInterval(() => this.updateLinksAndProcessBatch(), 4 * 60 * 1000);
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
  async extractProductFromHtml(html: string) {
    const $ = cheerio.load(html);
    const cleanedHtml = $('body').html()?.replace(/\s+/g, ' ').trim() || '';

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
${cleanedHtml}
    `;

    const aiResponse = await this.togetherAI.chat(prompt);

    this.logger.debug('Ответ от ИИ:', aiResponse);

    const match = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonContent = match?.[1]?.trim();

    if (!jsonContent) {
      JSON.parse(aiResponse);
      jsonContent = aiResponse.trim();
    }

    try {
      const product = JSON.parse(jsonContent);
      return product;
    } catch (err) {
      this.logger.warn('Ошибка при парсинге JSON от ИИ:', jsonContent);
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
