import { AdvertDetails, AdvertProperty } from 'src/@types/product.types';

export function advertMapper(rawItems: AdvertDetails[]) {
  const items: AdvertDetails[] = rawItems.map((item) => ({
    ...item,
    properties: item.properties as unknown as AdvertProperty[],
  }));

  return { items };
}
