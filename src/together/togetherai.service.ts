import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TogetherPrompt } from 'src/@types/together.types';

@Injectable()
export class TogetherAIService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TOGETHER_API_KEY') || '';
  }

  async getCompletions(messages: TogetherPrompt[], jsonSchema: any) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek/deepseek-r1-0528:free',
          messages,
          response_format: { type: 'json_object', schema: jsonSchema },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
  
      const content = response.data.choices[0].message?.content;
  
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
