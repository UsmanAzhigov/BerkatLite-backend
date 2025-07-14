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
