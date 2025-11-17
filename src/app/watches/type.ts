// TODO 
// indentify which fields should be optional and which should not

export interface Product {
  id: string;
  name: string;
  priceDkk: number;
  stock: number;
  productType: string;
  description: string;

  watch: {
    id: string;
    slug: string;
    productId: string;
    brandId: string;
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
      id: string;
      name: string;  
      country: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      zipCode: string | null;
      city: string | null;
      stateProvince: string | null;
      phoneNumber: string | null;
      email: string | null;
      website: string | null;
    };
  };

  productImages: Array<{
    id: string;
    productId: string | null;
    imageUrl: string | null;
    isThumbnail: boolean | null;
  }>;
}