import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async getAll(@Query() query) {
    return this.productService.findAll(query);
  }

  @Get('product')
  async getProduct() {
    return this.productService.parsePage(
      'https://berkat.ru/6098297-ustanovka-gbo-g-sunzha-rassrochka-bez-pervogo-vznosa.html',
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }
}
