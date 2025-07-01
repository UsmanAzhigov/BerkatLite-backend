import { Controller, Get } from '@nestjs/common';
import { OpenAIService } from './openai.service';

@Controller('open-ai')
export class OpenAIController {
  constructor(private readonly openAIService: OpenAIService) {}

  @Get('')
  async getAIResponse() {
    const response = await this.openAIService.chat(
      'https://berkat.ru/6128277-igrovoi-pk.html перейди по этой ссылке и достань мне title, description, price, phone, city, createdAt и его properties, так же тебе нужно достань title и description этого товара, который в этой ссылке и сгенерировать свой title, description, чтобы не было лишнего текста и чтоб человек понимал по заголовку и описанию что это за товар',
    );
    return { message: response };
  }
}
