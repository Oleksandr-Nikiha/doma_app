// Типи дзеркалять Pydantic-схеми бекенду (api/src/schemas/).
// При зміні схем на бекенді — оновити тут.

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  location_id: number;
  location_name: string;
}

export interface ProductListItem {
  id: number;
  name: string;
  image_url: string | null;
  price_from: number;
}

export interface ProductVariant {
  id: number;
  label: string;
  weight: string | null;
  price: number;
}

export interface ProductDetail {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  variants: ProductVariant[];
}

export interface User {
  id: number;
  telegram_id: number;
  full_name: string;
  phone: string;
  delivery_address: string | null;
}

export interface RegisterPayload {
  full_name: string;
  phone: string;
  delivery_address: string | null;
}

export interface CartItem {
  id: number;
  product_id: number;
  product_name: string;
  variant_label: string;
  weight: string | null;
  price: number;
  qty: number;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  phones: string[];
}
