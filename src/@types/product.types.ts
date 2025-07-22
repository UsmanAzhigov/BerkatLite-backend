import { Prisma } from 'generated/prisma';

export interface AdvertProperty {
  name: string;
  text: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  take: number;
  totalPages: number;
}

export interface GetAllParams {
  categoryId?: string;
  cityId?: string;
  page?: number;
  take?: number;
  search?: string;
  sortBy?: 'price' | 'createdAt' | 'views';
  sortOrder?: 'asc' | 'desc';
  priceFrom?: number;
  priceTo?: number;
}

export interface ProductFiltersParams {
  categoryId?: string;
  cityId?: string;
  search?: string;
  priceFrom?: number;
  priceTo?: number;
}

export interface AdvertTransactionProps {
  where: Prisma.ProductWhereInput;
  skip: number;
  take: number;
  sortBy: 'price' | 'createdAt' | 'views';
  sortOrder: 'asc' | 'desc';
}

export interface AdvertDetails {
  description: string;
  images: string[];
  phone: string | null;
  price: number | null;
  categoryId: string;
  views: number;
  cityId: string;
  createdAt: string;
  sourceUrl: string;
  properties: AdvertProperty[];
}
