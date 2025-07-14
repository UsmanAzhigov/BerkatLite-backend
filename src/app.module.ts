import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductModule } from './product/product.module';
import { ConfigModule } from '@nestjs/config';
import { TogetherAIModule } from './together/togetherai.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ParserService } from './parser.service';
import { PrismaService } from './prisma.service';
import { GenerateService } from './generate.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ProductModule,
    TogetherAIModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, ParserService, PrismaService, GenerateService],
})
export class AppModule {}
