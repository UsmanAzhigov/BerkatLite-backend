import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiQuery({ name: 'category', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  findAll(
    @Query('page') page?: string,
    @Query('take') take?: string,
    @Query('category') category?: string,
  ) {
    return this.productService.findAll(
      category,
      Number(page || 1),
      take || '10',
    );
  }

  @Get('filter')
  @ApiQuery({ name: 'priceFrom', type: Number, required: false })
  @ApiQuery({ name: 'priceTo', type: Number, required: false })
  @ApiQuery({ name: 'city', type: String, required: false })
  findByFilter(
    @Query('priceFrom') priceFrom?: number,
    @Query('priceTo') priceTo?: number,
    @Query('city') city?: string,
  ) {
    return this.productService.findByFilter(priceFrom, priceTo, city);
  }

  @Get('sort')
  @ApiQuery({ name: 'sort', type: String })
  @ApiQuery({ name: 'sortBy', type: String })
  findBySort(
    @Query('sort') sort: 'asc' | 'desc',
    @Query('sortBy') sortBy: 'price' | 'createdAt' | 'popular',
  ) {
    return this.productService.findBySort(sort, sortBy);
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
}
