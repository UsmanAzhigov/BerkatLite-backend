import { Injectable } from '@nestjs/common';
import { TogetherAIService } from './together/togetherai.service';
import { AdvertDetails } from './@types/product.types';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const advertSchema = z.object({
  title: z.string().describe('Заголовок'),
  price: z.string().describe('Цена'),
  phone: z.string().describe('Телефон продавца'),
  description: z.string().describe('Отформатированное описание'),
  is_hren: z
    .boolean()
    .describe(
      'Если это рекламное объявление о предоставлении услуг, реклама и т.п., то true. Если это нормальное объявление о покупке, продаже, обмене и т.п., то false (значит ок и оно полезное)',
    ),
});

const jsonSchema = zodToJsonSchema(advertSchema, { target: 'openAi' });

type Advert = z.infer<typeof advertSchema>;

function convertPropertiesToStr(obj: Record<string, any>): string {
  return Object.entries(obj)
    .map(([key, value]) => `${key}:${value};`)
    .join('');
}

@Injectable()
export class GenerateService {
  constructor(private readonly togetherAIService: TogetherAIService) {}

  async generateAdvert(details: AdvertDetails): Promise<Advert> {
    const detailsStr = `
    <title>${details.title}</title>
    <description>${details.description}</description>
    <price>${details.price}</price>
    <phone>${details.phone}</phone>
    <details>${convertPropertiesToStr(details.properties)}</details>
    `;

    const result = await this.togetherAIService.getCompletions(
      [
        {
          role: 'system',
          content: `Ты парсер объявлений. Я тебе буду передавать детали объявлений которые я парсил. Ты должен аккуратно всё отформатировать.
          { 
title: Отформатированный заголовок объявления. Заголовок не должен быть с маленькой буквы и должен содержать информацию о самом объявлении, будь это машина или недвижимость
price: Цена объявления. Еще юзеры бывают тупые и могут стоимость указывать 0 руб, а в описании уже правильную. Если в <price> не будет цены, то ищи ее в описании, если нету, то возвращай то, что есть в <price>. Автор объявления может указать 300, это значит что машина не стоит 300 руб, а 300000. Следуй этой логике, если видишь, что стоимость слишком маленькая для крупого объявления
phone: Телефон продавца. Если в описании указан номер, но в <phone> нет номера, то вытащи его из описания и добавь в поле phone.
properties: Характеристики объявления => Array<{name: Название характеристики, value: Значение характеристики}>
description: Отформатированное описание объявления латиницей. Исключи из описания номер телефона, стоимость, город. Сделай описание красивым и аккуратным, без лишнего мусора и деталей, которые уже есть в details.
}
          `,
        },
        {
          role: 'user',
          content: detailsStr,
        },
      ],
      jsonSchema,
    );

    return result;
  }
}
