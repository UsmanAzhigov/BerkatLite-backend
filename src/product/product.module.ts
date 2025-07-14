import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TogetherAIModule } from '../together/togetherai.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [TogetherAIModule],
  controllers: [ProductController],
  providers: [ProductService, PrismaService],
  exports: [ProductService],
})
export class ProductModule {}
