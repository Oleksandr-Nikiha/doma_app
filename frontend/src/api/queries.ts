import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import type {
  Cart,
  Category,
  Location,
  ProductDetail,
  ProductListItem,
  RegisterPayload,
  User,
} from "@/api/types";

/** Ключі кешу зібрані в одному місці — щоб інвалідація не розповзалась по компонентах. */
export const keys = {
  me: ["me"] as const,
  categories: ["categories"] as const,
  products: (categoryId: number) => ["products", categoryId] as const,
  product: (productId: number) => ["product", productId] as const,
  cart: ["cart"] as const,
  locations: ["locations"] as const,
};

// --- Каталог і контакти (публічні) ---

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => api.get<Category[]>("/categories") });
}

export function useProducts(categoryId: number) {
  return useQuery({
    queryKey: keys.products(categoryId),
    queryFn: () => api.get<ProductListItem[]>(`/categories/${categoryId}/products`),
  });
}

export function useProduct(productId: number) {
  return useQuery({
    queryKey: keys.product(productId),
    queryFn: () => api.get<ProductDetail>(`/products/${productId}`),
  });
}

export function useLocations() {
  return useQuery({ queryKey: keys.locations, queryFn: () => api.get<Location[]>("/locations") });
}

// --- Профіль ---

/**
 * 404 тут — не помилка, а «користувач ще не зареєстрований»: саме так бекенд
 * відповідає на /me для незнайомого telegram_id. Тому не ретраїмо і віддаємо null.
 */
export function useMe(): UseQueryResult<User | null> {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api.get<User>("/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    retry: (count, e) => !(e instanceof ApiError && e.status < 500) && count < 2,
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => api.post<User>("/register", payload),
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  });
}

// --- Кошик ---
// Усі мутації бекенд повертає вже оновленим кошиком, тож замість інвалідації
// одразу кладемо відповідь у кеш — на один зайвий запит менше.

export function useCart() {
  return useQuery({ queryKey: keys.cart, queryFn: () => api.get<Cart>("/cart") });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { variant_id: number; qty: number }) => api.post<Cart>("/cart/items", v),
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; qty: number }) =>
      api.patch<Cart>(`/cart/items/${v.itemId}`, { qty: v.qty }),
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.delete<Cart>(`/cart/items/${itemId}`),
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<Cart>("/cart"),
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}
