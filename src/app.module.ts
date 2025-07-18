import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TogetherAIModule } from './together/togetherai.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ParserService } from './parser.service';
import { PrismaService } from './prisma.service';
import { GenerateService } from './generate.service';
import { ProductService } from './product.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TogetherAIModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ParserService,
    PrismaService,
    GenerateService,
    ProductService,
  ],
})
export class AppModule {}
