import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AdvertDetails, AdvertProperty } from './@types/product.types';
import { PrismaService } from './prisma.service';
import { uploader } from './utils/uploader';

@Injectable()
export class ParserService {
  private doc: cheerio.CheerioAPI;

  constructor(private readonly prisma: PrismaService) {}

  public setDoc(doc: cheerio.CheerioAPI) {
    this.doc = doc;
  }

  private async getImages(): Promise<string[]> {
    const images: string[] = [];

    this.doc('.fotorama img').each((_, el) => {
      const src = this.doc(el).attr('src');
      const hasDomain = src?.startsWith('http');

      if (src) {
        const fullUrl = hasDomain ? src : `https://berkat.ru${src}`;
        if (!images.includes(fullUrl)) {
          images.push(fullUrl);
        }
      }
    });

    return images;
  }

  private getPhone(): string | null {
    return this.doc('[href^="tel:"]').attr('href')?.replace('tel:', '') ?? null;
  }

  private getPrice(): number | null {
    const priceText = this.doc('.board_item_price span')
      .first()
      .text()
      .replace(/\s/g, '');

    return priceText ? Number(priceText.replace(/[^\d]/g, '')) : null;
  }

  private getViews(): number {
    return (
      Number(this.doc('.board_item_hits').text().replace('Просмотры: ', '')) ||
      0
    );
  }

  private getCreatedAt(): string {
    return this.doc('.board_item_date time').first().text().trim();
  }

  private getDescription(): string {
    return this.doc('.board_item_desc').text().trim().split('\t\t\t')[0];
  }

  private getCategoryName(): string {
    return this.doc('#breadcrumbs [itemprop="title"]').first().text().trim();
  }

  private getCityName(): string {
    return this.doc('.board_item_city').text().trim();
  }

  private getProperties(): AdvertProperty[] {
    const properties: AdvertProperty[] = [];

    this.doc('.content_item_props table tr').each((_, el) => {
      const name = this.doc(el).find('td.title').text().trim();
      const text = this.doc(el).find('td.value').text().trim();

      if (name && text) {
        properties.push({ name, text });
      }
    });

    return properties;
  }

  public async getDocument(url: string): Promise<cheerio.CheerioAPI> {
    const response = await axios.get(url);
    return cheerio.load(response.data);
  }

  public async getLinks(url: string): Promise<string[]> {
    const $ = await this.getDocument(url);
    const items = $('.board_list_item');
    const links: string[] = [];

    items.each((_, el) => {
      const isReklama = $(el).find('.board_actions_link_admin_top').length > 0;

      if (!isReklama) {
        const href = $(el).find('.board_list_item_title a').attr('href');
        if (href) {
          links.push(`https://berkat.ru${href}`);
        }
      }
    });

    return links;
  }

  public async getOneAdvertDetails(url: string): Promise<AdvertDetails> {
    const doc = await this.getDocument(url);
    this.setDoc(doc);

    const description = this.getDescription();
    const images = await this.getImages();
    const localImages: string[] = [];
    const phone = this.getPhone();
    const price = this.getPrice();
    const views = this.getViews();
    const createdAt = this.getCreatedAt();
    const properties = this.getProperties();
    const sourceUrl = url;
    const cityName = this.getCityName();
    const categoryName = this.getCategoryName();

    if (!cityName) throw new Error('Не удалось найти город');

    let city = await this.prisma.city.findUnique({ where: { name: cityName } });
    if (!city) {
      city = await this.prisma.city.create({ data: { name: cityName } });
    }

    if (!categoryName) throw new Error('Не удалось найти категорию');

    let category = await this.prisma.category.findUnique({
      where: { name: categoryName },
    });

    if (!category) {
      category = await this.prisma.category.create({
        data: { name: categoryName },
      });
    }

    for (let i = 0; i < images.length; i++) {
      const imageUrl = images[i];
      try {
        const localPath = await uploader(imageUrl, 'uploads', i);
        localImages.push(`http://localhost:4444${localPath}`);
      } catch (err) {
        console.error(`Не удалось скачать ${imageUrl}:`, err.message);
      }
    }

    return {
      description,
      images: localImages,
      phone,
      price,
      views,
      createdAt,
      cityId: city.id,
      categoryId: category.id,
      sourceUrl,
      properties,
    };
  }

  public async getLastAdvertAutoUrl(): Promise<string> {
    const links = await this.getLinks(
      'https://berkat.ru/avto/legkovye-avtomobili',
    );
    return links[0];
  }

  public async getLastAdvertRealtyUrl(): Promise<string> {
    const links = await this.getLinks('https://berkat.ru/nedvizhimost');
    return links[0];
  }
}
