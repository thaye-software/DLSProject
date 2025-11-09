// TODO 
// indentify which fields should be optional and which should not

export interface Product {
  id: number;
  name: string;
  priceDkk: number;
  stock: number;
  productType: string;
  description: string;

  watch: {
    id: number;
    productId: number;
    brandId: number;
    model: string;
    reference: string;
    serialNumber: string;
    year: number;
    size: string | null;
    movement: string | null;
    glassType: string | null;
    limited: boolean;
    box: boolean;
    papers: boolean;
    condition: number;
    braceletType: string | null;
    braceletColor: string | null;
    dialColor: string | null;
    vat: number | null;
    brand: {
      id: number;
      name: string;
      slug: string | null;
      productSafetyInfoId: number | null;
      productSafetyInfo: {
        id: number | string;
        country: string | null;
        address: string | null;
        address2: string | null;
        zipCode: string | null;
        city: string | null;
        stateProvince: string | null;
        phoneNumber: string | null;
        email: string | null;
        website: string | null;
      } | null;
    };
  };

  productImages: Array<{
    id: number;
    productId: number | null;
    imageUrl: string | null;
    isThumbnail: boolean | null;
  }>;
}