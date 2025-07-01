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

  @Get('berkat-links')
  getBerkatLinks() {
    return this.productService.getAllLinks();
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
