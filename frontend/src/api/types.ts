// Типи дзеркалять Pydantic-схеми бекенду (api/src/schemas/).
// При зміні схем на бекенді — оновити тут.

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  /** null = коренева категорія. Дерево дворівневе: корінь → підкатегорія. */
  parent_id: number | null;
  location_id: number;
  location_name: string;
}

export interface ProductListItem {
  id: number;
  name: string;
  image_url: string | null;
  price_from: number;
  /** Підкатегорія, до якої належить товар — за нею групуємо список у секції. */
  category_id: number;
  category_name: string;
}

export interface ProductVariant {
  id: number;
  label: string;
  weight: string | null;
  price: number;
}

/** Одна позиція в групі опцій. variant_id — те, що відправляємо назад у кошик. */
export interface OptionItem {
  variant_id: number;
  name: string;
  price_delta: number;
}

/**
 * Група опцій товару: «Соус до картоплі», «Напій 0.5 л».
 * min_select/max_select приходять зі звʼязку товар↔група, а не з самої групи:
 * та сама група для хенд-рола це 1 з 3, а для СЕТу — 3 з 3.
 */
export interface OptionGroup {
  group_id: number;
  name: string;
  min_select: number;
  max_select: number;
  /** Скільки порцій у групі безкоштовні: соус до картоплі — перша. */
  free_count: number;
  items: OptionItem[];
}

export interface ProductDetail {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  variants: ProductVariant[];
  option_groups: OptionGroup[];
}

export interface User {
  id: number;
  telegram_id: number;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone: string;
  delivery_address: string | null;
  additional_address?: string | null;
  client_code?: string | null;
  bonus_balance?: number;
}

export interface UserUpdatePayload {
  first_name: string;
  last_name?: string | null;
  delivery_address?: string | null;
  additional_address?: string | null;
}

export interface RegisterPayload {
  full_name: string;
  phone: string;
  delivery_address: string | null;
}

/** Вибір опції для відправки в кошик. */
export interface OptionSelection {
  group_id: number;
  variant_id: number;
  /** Кілька порцій однієї опції: два кетчупи — це qty = 2, а не два записи. */
  qty: number;
}

export interface CartItemOption {
  group_id: number;
  variant_id: number;
  /** Назва товару-опції: «Кетчуп». */
  name: string;
  /** Мітка варіанта: «0.5 л». Для соусів це «порція» — показуємо не завжди. */
  label: string;
  price_delta: number;
  qty: number;
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
  location_id: number;
  location_name: string;
  options: CartItemOption[];
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

export interface OrderCreatePayload {
  fulfillment_type: "delivery" | "pickup";
  location_id?: number | null;
  delivery_address?: string | null;
  contact_name: string;
  contact_phone: string;
  payment_method: "cash" | "card";
  comment?: string | null;
}

export interface OrderItemOption {
  id: number;
  option_group_name: string;
  option_name: string;
  price_delta: number;
  qty: number;
}

export interface OrderItem {
  id: number;
  variant_id: number | null;
  product_name: string;
  variant_label: string;
  unit_price: number;
  qty: number;
  subtotal: number;
  options: OrderItemOption[];
}

export interface OrderGroup {
  id: number;
  location_id: number;
  location_name: string;
  status: string;
  subtotal: number;
  items: OrderItem[];
}

export interface Order {
  id: number;
  telegram_id: number;
  status: string;
  fulfillment_type: "delivery" | "pickup";
  delivery_address: string | null;
  contact_name: string;
  contact_phone: string;
  payment_method: "cash" | "card";
  comment: string | null;
  total_price: number;
  created_at: string;
  groups: OrderGroup[];
}
