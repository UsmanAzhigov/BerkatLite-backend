export interface AdvertProperty {
  name: string;
  text: string;
}

export interface AdvertDetails {
  title: string;
  description: string;
  images: string[];
  phone: string | null;
  price: number | null;
  views: number;
  city: string | null;
  createdAt: string;
  properties: AdvertProperty[];
}
