import type {
  Category,
  DeliveryAddress,
  LocationInfo,
  ProductDetail,
  ProductListItem,
} from "../types/catalog.ts";
import type { OrderOut, WebOrderCreatePayload } from "../types/order.ts";

export const CROISSANTS_LOCATION_ID = 2;

export function getImageUrl(path: string | null | undefined): string {
  if (!path) return "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

export async function fetchCategories(locationId: number = CROISSANTS_LOCATION_ID): Promise<Category[]> {
  const res = await fetch(`/api/categories?location_id=${locationId}`);
  if (!res.ok) throw new Error("Не вдалося завантажити категорії");
  return res.json();
}

export async function fetchProductsByCategory(categoryId: number): Promise<ProductListItem[]> {
  const res = await fetch(`/api/categories/${categoryId}/products`);
  if (!res.ok) throw new Error("Не вдалося завантажити страви категорії");
  return res.json();
}

export async function fetchProductDetail(productId: number): Promise<ProductDetail> {
  const res = await fetch(`/api/products/${productId}`);
  if (!res.ok) throw new Error("Не вдалося завантажити інформацію про страву");
  return res.json();
}

export async function fetchLocationInfo(locationId: number = CROISSANTS_LOCATION_ID): Promise<LocationInfo | null> {
  const res = await fetch("/api/locations");
  if (!res.ok) throw new Error("Не вдалося завантажити інформацію про заклад");
  const list: LocationInfo[] = await res.json();
  return list.find((loc) => loc.id === locationId) || list[0] || null;
}

export async function fetchDeliveryAddresses(city: string = "Вишгород"): Promise<DeliveryAddress[]> {
  const res = await fetch(`/api/delivery/addresses?city=${encodeURIComponent(city)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function submitWebOrder(payload: WebOrderCreatePayload): Promise<OrderOut> {
  const res = await fetch("/api/orders/web", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Не вдалося оформити замовлення");
  }

  return res.json();
}

export async function fetchWebOrder(orderId: number): Promise<OrderOut> {
  const res = await fetch(`/api/orders/web/${orderId}`);
  if (!res.ok) throw new Error("Замовлення не знайдено");
  return res.json();
}

