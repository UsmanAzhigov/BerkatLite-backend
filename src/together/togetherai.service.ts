import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TogetherAIService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.together.xyz/v1/chat/completions';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TOGETHER_API_KEY') || '';
  }

  async chat(prompt: string) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log(
        'Ответ от Together AI:',
        response.data.choices?.[0]?.message?.content || response.data,
      );

      const message =
        response.data.choices?.[0]?.message?.content ?? 'Нет ответа';
      return message;
    } catch (error) {
      console.error('Together AI error:', error.response?.data || error);
      return 'Ошибка при обращении к Together AI';
    }
  }
}
