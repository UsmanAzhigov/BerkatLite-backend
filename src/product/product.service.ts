import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async findAll(category?: string) {
    return this.prisma.product.findMany({
      where: category
        ? {
            category: {
              equals: category,
              mode: 'insensitive',
            },
          }
        : {},
    });
  }

  async findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
    });
  }

  async searchProducts(query: string) {
    return this.prisma.product.findMany({
      where: {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
    });
  }

  findByCategory(category: string) {
    return this.prisma.product.findMany({
      where: {
        category,
      },
    });
  }

  async findByFilter(filter: {
    price?: number;
    city?: string;
    reviews?: number;
  }) {
    return this.prisma.product.findMany({
      where: {
        price: filter.price,
        city: filter.city,
        reviews: filter.reviews,
      },
    });
  }
}
