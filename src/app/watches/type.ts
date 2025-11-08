export interface Products {
  id: number;
  name: string;
  priceDkk: number;
  stock: number;
  productType: string;
  description: string;
  watch: {
    model: string;
    brand: {
      id: number;
      name: string;
    }
  };
  productImages: Array<{
    imageUrl: string;
  }>;
}