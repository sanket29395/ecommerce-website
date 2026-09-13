export type Variant = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  active: boolean;
};
export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parent?: Pick<Category, "id" | "name" | "slug"> | null;
  children?: Category[];
};
export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  images: string[];
  active: boolean;
  featured: boolean;
  minPrice: number | null;
  categoryId: string;
  category?: Category;
  variants: Variant[];
};
export type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};
export type Order = {
  id: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  refundedAmount: number;
  createdAt: string;
  trackingUrl?: string;
  carrier?: string;
  address: Address;
  user?: { name: string; email: string };
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    sku: string;
  }[];
};
