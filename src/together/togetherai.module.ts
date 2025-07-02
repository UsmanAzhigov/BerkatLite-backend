import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TogetherAIService } from './togetherai.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [TogetherAIService],
  exports: [TogetherAIService],
})
export class TogetherAIModule {}
