import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  price: number;

  @IsArray()
  images: string[];

  @IsString()
  category: string;

  @IsNumber()
  popular: number;

  @IsString()
  city: string;

  @IsArray()
  phone: string[];

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;
}
