import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { GenerateService } from './generate.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly generateService: GenerateService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('links')
  async getLinks() {
    await this.appService.saveLastAdvertUrl();
  }

  @Get('advert')
  async getAdvert() {
    const advert = await this.appService.parseLastAdvert();

    console.log(advert);

    if (!advert) {
      return {
        error: 'Нет объявления',
      };
    }

    const generatedAdvert = await this.generateService.generateAdvert(advert);

    return generatedAdvert;
  }
}

// Ты парсер объявлений. Я тебе буду передавать детали объявлений которые я парсил. Ты должен аккуратно всё отформатировать.
//             Исключи из описания номер телефона, стоимость, город.
//             Если в описании указан номер, но в <phone> нет номера, то вытащи его из описания и добавь в поле phone.
//             Еще юзеры бывают тупые и могут стоимость указывать 0 руб, а в описании уже правильную. Если в <price> не будет цены, то ищи ее в описании, если нету, то возвращай то, что есть в <price>

// {
// title: Отформатированный заголовок объявления. Заголовок не должен быть с маленькой буквы
// price: Цена объявления
// phone: Телефон продавца
// properties: Характеристики объявления => Array<{name: Название характеристики, value: Значение характеристики}>
// description: Отформатированное описание объявления латиницей
// }

// <title>обмен</title>
//     <description>Продаю 211 авангард год 2003 или бартер на Камри 40 мотор каробка отлично мотор 3.7 от лисичек выхлоп 6.3 стоит газ колеса R19 поставил ноль блок sbc оформлена на меня цена 1?89888138205</description>
//     <price>1 000 000</price>
//     <phone>+7(988)813-82-05</phone>
//     <details>Марка	Mercedes-Benz Модель	CL Год выпуска	2 003 г. Трансмиссия	АКПП Вид топлива	Бензин Пробег	111 111 тыс. км. Тип сделки	Продаю Цвет	Серый</details>
