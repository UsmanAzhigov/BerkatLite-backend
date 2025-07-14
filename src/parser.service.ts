import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AdvertDetails, AdvertProperty } from './@types/product.types';

@Injectable()
export class ParserService {
  private doc: cheerio.CheerioAPI;

  public setDoc(doc: cheerio.CheerioAPI) {
    this.doc = doc;
  }

  private getTitle(): string {
    return this.doc('h1')
      .text()
      .replace(/\t|\n/g, '')
      .split('Поднять в списке')[1];
  }

  private getImages(): string[] {
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

    const price = priceText ? Number(priceText.replace(/[^\d]/g, '')) : null;

    return price;
  }

  private getViews(): number {
    return Number(
      this.doc('.board_item_hits').text().replace('Просмотры: ', ''),
    );
  }

  private getCity(): string | null {
    return this.doc('.board_item_city').text().trim() || null;
  }

  private getCreatedAt(): string {
    return this.doc('.board_item_date time').first().text().trim();
  }

  private getDescription(): string {
    return this.doc('.board_item_desc').text().trim().split('\t\t\t')[0];
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

  public getDetailsFromDoc(): AdvertDetails {
    const title = this.getTitle();
    const description = this.getDescription();
    const images = this.getImages();
    const phone = this.getPhone();
    const price = this.getPrice();
    const views = this.getViews();
    const city = this.getCity();
    const createdAt = this.getCreatedAt();
    const properties = this.getProperties();

    return {
      title,
      description,
      images,
      phone,
      price,
      views,
      city,
      createdAt,
      properties,
    };
  }

  public async getLinks(url: string) {
    const $ = await this.getDocument(url);

    const items = $('.board_list_item');

    const links: string[] = [];

    items.each((_, el) => {
      const isReklama = $(el).find('.board_actions_link_admin_top').length > 0;

      if (!isReklama) {
        const url = $(el).find('.board_list_item_title a').attr('href');

        if (url) {
          links.push(`https://berkat.ru${url}`);
        }
      }
    });

    return links;
  }

  public async getOneAdvertDetails(url: string) {
    const doc = await this.getDocument(url);

    this.setDoc(doc);

    const details = this.getDetailsFromDoc();

    return details;
  }

  public async getLastAdvertUrl(): Promise<string> {
    const links = await this.getLinks(
      'https://berkat.ru/avto/legkovye-avtomobili',
    );

    return links[0];
  }
}
