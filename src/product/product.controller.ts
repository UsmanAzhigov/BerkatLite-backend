import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiQuery({ name: 'category', type: String, required: false })
  findAll(@Query('category') category?: string) {
    return this.productService.findAll(category);
  }

  @Get('search')
  @ApiQuery({ name: 'query', type: String })
  searchProducts(@Query('query') query: string) {
    return this.productService.searchProducts(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Get('category/:category')
  findByCategory(@Param('category') category: string) {
    return this.productService.findByCategory(category);
  }

  @Get('filter')
  @ApiQuery({ name: 'price', type: Number })
  @ApiQuery({ name: 'city', type: String })
  @ApiQuery({ name: 'reviews', type: Number })
  findByFilter(
    @Query()
    filter: {
      price: number;
      city: string;
      reviews: number;
    },
  ) {
    return this.productService.findByFilter(filter);
  }
}
