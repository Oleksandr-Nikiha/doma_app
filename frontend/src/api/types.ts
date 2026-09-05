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
  phone: string;
  delivery_address: string | null;
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
