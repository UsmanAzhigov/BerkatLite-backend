import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class OpenAIService {
  private openai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    this.openai = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
    });
  }

  async chat(prompt: string) {
    try {
      const result = await this.openai.models.generateContent({
        model: 'gemini-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return result.text;
    } catch (error) {
      console.error('Gemini API error:', error);
      return 'Ошибка при обращении к Gemini API';
    }
  }
}
