import { Injectable } from '@nestjs/common';
import { AdvertDetails } from 'src/@types/product.types';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  // async createProduct(data: AdvertDetails) {
  //   const product = await this.prisma.product.create({
  //     data,
  //   });

  //   return product;
  // }
}
