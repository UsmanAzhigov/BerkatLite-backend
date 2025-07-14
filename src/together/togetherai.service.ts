import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TogetherPrompt } from 'src/@types/together.types';
import { Together } from 'together-ai';

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY || '',
});

@Injectable()
export class TogetherAIService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.together.xyz/v1/chat/completions';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TOGETHER_API_KEY') || '';
  }

  async getCompletions(messages: TogetherPrompt[], jsonSchema: any) {
    try {
      const response = await together.chat.completions.create({
        response_format: { type: 'json_object', schema: jsonSchema },
        messages: messages,
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      });

      const content = response.choices[0].message?.content;

      if (!content) {
        throw new Error('No content');
      }

      const result = JSON.parse(content);

      return result;
    } catch (error) {
      console.error('Ошибка Together AI:', error);
      return null;
    }
  }
}
