import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, api, hasTelegramAuth } from "@/api/client";
import {
  addGuestItem,
  clearGuestCart,
  getGuestCart,
  removeGuestItem,
  updateGuestItemQty,
} from "@/store/guestCart";
import type {
  AdminCategory,
  AdminMe,
  AdminOptionGroup,
  AdminOptionGroupItem,
  AdminProduct,
  AdminVariant,
  BulkAvailabilityPayload,
  BulkOptionGroupPayload,
  Cart,
  CartItemOption,
  Category,
  CategoryCreatePayload,
  CategoryUpdatePayload,
  Location,
  LocationDeliverySettings,
  LocationDeliveryUpdatePayload,
  Manager,
  ManagerCreatePayload,
  ManagerUpdatePayload,
  OptionGroupCreatePayload,
  OptionGroupItemCreatePayload,
  OptionGroupItemUpdatePayload,
  OptionGroupUpdatePayload,
  OptionSelection,
  Order,
  OrderCreatePayload,
  RepeatOrderResponse,
  ProductCreatePayload,
  ProductDetail,
  ProductListItem,
  ProductOptionGroupAdmin,
  ProductOptionGroupAttachPayload,
  ProductOptionGroupUpdatePayload,
  ProductUpdatePayload,
  RegisterPayload,
  User,
  UserUpdatePayload,
  VariantCreatePayload,
  VariantSelectorChoice,
  VariantUpdatePayload,
  AdminUser,
  AdminUserUpdatePayload,
  AdminOrderListItem,
  AdminOrderDetail,
  AdminOrderUpdatePayload,
  DeliveryAddress,
  AdminDeliveryAddress,
  DeliveryAddressCreatePayload,
  DeliveryAddressUpdatePayload,
  AnalyticsSummary,
  AnalyticsTopProduct,
  Broadcast,
  BroadcastCreatePayload,
  BroadcastRecipientsCount,
} from "@/api/types";

/** Ключі кешу зібрані в одному місці — щоб інвалідація не розповзалась по компонентах. */
export const keys = {
  me: ["me"] as const,
  categories: ["categories"] as const,
  products: (categoryId: number) => ["products", categoryId] as const,
  product: (productId: number) => ["product", productId] as const,
  cart: ["cart"] as const,
  locations: ["locations"] as const,
  orders: ["orders"] as const,
  order: (orderId: number) => ["order", orderId] as const,
  adminMe: ["admin", "me"] as const,
  adminManagers: ["admin", "managers"] as const,
  adminCategories: (locationId?: number | null) => ["admin", "categories", locationId] as const,
  adminProducts: (params?: { categoryId?: number | null; locationId?: number | null }) =>
    ["admin", "products", params] as const,
  adminOptionGroups: ["admin", "option-groups"] as const,
  adminOptionGroupItems: (groupId: number) => ["admin", "option-groups", groupId, "items"] as const,
  adminVariantChoices: ["admin", "variant-choices"] as const,
  adminLocationsDelivery: ["admin", "locations", "delivery"] as const,
  adminDeliveryAddresses: (params?: { city?: string; search?: string; isActive?: boolean }) =>
    ["admin", "delivery", "addresses", params] as const,
  deliveryCities: ["delivery", "cities"] as const,
  deliveryAddresses: (city?: string) => ["delivery", "addresses", city] as const,
  adminUsers: (query: string) => ["admin", "users", query] as const,
  adminOrders: (params?: { status?: string | null; locationId?: number | null }) =>
    ["admin", "orders", params?.status, params?.locationId] as const,
  adminOrder: (orderId: number) => ["admin", "order", orderId] as const,
  adminAnalyticsSummary: (params?: { period?: string; locationId?: number | null }) =>
    ["admin", "analytics", "summary", params] as const,
  adminAnalyticsTopProducts: (params?: { period?: string; locationId?: number | null; limit?: number }) =>
    ["admin", "analytics", "top-products", params] as const,
  adminBroadcastRecipientsCount: (segment: string) =>
    ["admin", "broadcasts", "recipients-count", segment] as const,
  adminBroadcasts: ["admin", "broadcasts"] as const,
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
 * У режимі звичайного вебу без Telegram або при 401 повертаємо null (гість).
 */
export function useMe(): UseQueryResult<User | null> {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      if (!hasTelegramAuth()) {
        return null;
      }
      try {
        return await api.get<User>("/me");
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401)) return null;
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

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserUpdatePayload) => api.patch<User>("/me", payload),
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  });
}

// --- Кошик ---
// Для авторизованих клієнтів (у Telegram) кошик живе на сервері.
// Для гостей без авторизації зберігається у localStorage браузера.

export function useCart() {
  return useQuery({
    queryKey: keys.cart,
    queryFn: async () => {
      if (!hasTelegramAuth()) {
        return getGuestCart();
      }
      try {
        return await api.get<Cart>("/cart");
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
          return getGuestCart();
        }
        throw e;
      }
    },
  });
}

export interface AddToCartInput {
  variant_id: number;
  qty: number;
  options: OptionSelection[];
  guest_meta?: {
    product_id: number;
    product_name: string;
    variant_label: string;
    weight: string | null;
    price: number;
    location_id: number;
    location_name: string;
    options_details: CartItemOption[];
    group_free_count?: Record<number, number>;
  };
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: AddToCartInput) => {
      if (!hasTelegramAuth()) {
        if (!v.guest_meta) {
          throw new Error("Не вистачає даних товару для кошика гостя");
        }
        return addGuestItem({
          product_id: v.guest_meta.product_id,
          product_name: v.guest_meta.product_name,
          variant_id: v.variant_id,
          variant_label: v.guest_meta.variant_label,
          weight: v.guest_meta.weight,
          price: v.guest_meta.price,
          qty: v.qty,
          location_id: v.guest_meta.location_id,
          location_name: v.guest_meta.location_name,
          options: v.options,
          options_details: v.guest_meta.options_details,
          group_free_count: v.guest_meta.group_free_count,
        });
      }
      return api.post<Cart>("/cart/items", {
        variant_id: v.variant_id,
        qty: v.qty,
        options: v.options,
      });
    },
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { itemId: number; qty: number }) => {
      if (!hasTelegramAuth()) {
        return updateGuestItemQty(v.itemId, v.qty);
      }
      return api.patch<Cart>(`/cart/items/${v.itemId}`, { qty: v.qty });
    },
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: number) => {
      if (!hasTelegramAuth()) {
        return removeGuestItem(itemId);
      }
      return api.delete<Cart>(`/cart/items/${itemId}`);
    },
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!hasTelegramAuth()) {
        return clearGuestCart();
      }
      return api.delete<Cart>("/cart");
    },
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

// --- Замовлення ---

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrderCreatePayload) => api.post<Order>("/orders", payload),
    onSuccess: () => {
      // Бекенд видалив оформлені страви з кошика — оновлюємо дані кошика
      void qc.invalidateQueries({ queryKey: keys.cart });
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: keys.orders,
    queryFn: () => api.get<Order[]>("/orders"),
    enabled: hasTelegramAuth(),
  });
}

export function useOrder(orderId: number) {
  return useQuery({
    queryKey: keys.order(orderId),
    queryFn: () => api.get<Order>(`/orders/${orderId}`),
    enabled: orderId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 3500;
      // Опитуємо кожні 3.5 секунди, поки замовлення активне
      const terminalStatuses = ["completed", "rejected", "cancelled"];
      return !terminalStatuses.includes(status) ? 3500 : false;
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) =>
      api.post<Order>(`/orders/${orderId}/cancel`),
    onSuccess: (updatedOrder) => {
      qc.invalidateQueries({ queryKey: keys.orders });
      qc.setQueryData(keys.order(updatedOrder.id), updatedOrder);
    },
  });
}

export function useRepeatOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      replaceCart = true,
    }: {
      orderId: number;
      replaceCart?: boolean;
    }) =>
      api.post<RepeatOrderResponse>(`/orders/${orderId}/repeat`, {
        replace_cart: replaceCart,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.cart });
    },
  });
}

// ============================================================================
// Адмін-панель
// ============================================================================

// --- Права та статус співробітника ---

export function useAdminMe() {
  return useQuery({
    queryKey: keys.adminMe,
    queryFn: () => api.get<AdminMe>("/admin/me"),
    staleTime: 30000,
  });
}

// --- Управління менеджерами (Тільки Admin) ---

export function useAdminManagers() {
  return useQuery({
    queryKey: keys.adminManagers,
    queryFn: () => api.get<Manager[]>("/admin/managers"),
  });
}

export function useCreateManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManagerCreatePayload) => api.post<Manager>("/admin/managers", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminManagers });
    },
  });
}

export function useUpdateManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ managerId, payload }: { managerId: number; payload: ManagerUpdatePayload }) =>
      api.patch<Manager>(`/admin/managers/${managerId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminManagers });
    },
  });
}

export function useDeleteManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (managerId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/managers/${managerId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminManagers });
    },
  });
}

// --- Категорії ---

export function useAdminCategories(locationId?: number | null) {
  return useQuery({
    queryKey: keys.adminCategories(locationId),
    queryFn: () => {
      const qs = locationId ? `?location_id=${locationId}` : "";
      return api.get<AdminCategory[]>(`/admin/categories${qs}`);
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryCreatePayload) =>
      api.post<AdminCategory>("/admin/categories", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: number; payload: CategoryUpdatePayload }) =>
      api.patch<AdminCategory>(`/admin/categories/${categoryId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/categories/${categoryId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: keys.categories });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

// --- Страви (Товари) ---

export function useAdminProducts(params?: { categoryId?: number | null; locationId?: number | null }) {
  return useQuery({
    queryKey: keys.adminProducts(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.categoryId) sp.set("category_id", String(params.categoryId));
      if (params?.locationId) sp.set("location_id", String(params.locationId));
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      return api.get<AdminProduct[]>(`/admin/products${qs}`);
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductCreatePayload) =>
      api.post<AdminProduct>("/admin/products", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: keys.categories });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, payload }: { productId: number; payload: ProductUpdatePayload }) =>
      api.patch<AdminProduct>(`/admin/products/${productId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/products/${productId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// --- Варіанти цін ---

export function useCreateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, payload }: { productId: number; payload: VariantCreatePayload }) =>
      api.post<AdminVariant>(`/admin/products/${productId}/variants`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, payload }: { variantId: number; payload: VariantUpdatePayload }) =>
      api.patch<AdminVariant>(`/admin/variants/${variantId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/variants/${variantId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// --- Швидкий стоп-лист ---

export function useToggleProductAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isAvailable }: { productId: number; isAvailable: boolean }) =>
      api.patch<{ id: number; is_available: boolean }>(`/admin/products/${productId}/toggle-availability`, {
        is_available: isAvailable,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useToggleVariantAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, isAvailable }: { variantId: number; isAvailable: boolean }) =>
      api.patch<{ id: number; is_available: boolean }>(`/admin/variants/${variantId}/toggle-availability`, {
        is_available: isAvailable,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// --- Масові (Bulk) операції над стравами ---

export function useBulkProductAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkAvailabilityPayload) =>
      api.patch<{ updated_count: number; product_ids: number[]; is_available: boolean }>(
        "/admin/products/bulk/availability",
        payload,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useBulkProductOptionGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkOptionGroupPayload) =>
      api.post<{ updated_count: number; product_ids: number[]; action: string }>(
        "/admin/products/bulk/option-groups",
        payload,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

// --- Адмін-панель: Додатки (Option Groups) ---

export function useAdminOptionGroups() {
  return useQuery({
    queryKey: keys.adminOptionGroups,
    queryFn: () => api.get<AdminOptionGroup[]>("/admin/option-groups"),
  });
}

export function useCreateOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OptionGroupCreatePayload) =>
      api.post<AdminOptionGroup>("/admin/option-groups", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

export function useUpdateOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: number; payload: OptionGroupUpdatePayload }) =>
      api.patch<AdminOptionGroup>(`/admin/option-groups/${groupId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

export function useDeleteOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/option-groups/${groupId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

// --- Позиції в групі додатків ---

export function useAdminOptionGroupItems(groupId: number) {
  return useQuery({
    queryKey: keys.adminOptionGroupItems(groupId),
    queryFn: () => api.get<AdminOptionGroupItem[]>(`/admin/option-groups/${groupId}/items`),
    enabled: groupId > 0,
  });
}

export function useAddOptionGroupItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: number; payload: OptionGroupItemCreatePayload }) =>
      api.post<AdminOptionGroupItem>(`/admin/option-groups/${groupId}/items`, payload),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroupItems(vars.groupId) });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

export function useUpdateOptionGroupItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      variantId,
      payload,
    }: {
      groupId: number;
      variantId: number;
      payload: OptionGroupItemUpdatePayload;
    }) =>
      api.patch<AdminOptionGroupItem>(`/admin/option-groups/${groupId}/items/${variantId}`, payload),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroupItems(vars.groupId) });
    },
  });
}

export function useDeleteOptionGroupItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, variantId }: { groupId: number; variantId: number }) =>
      api.delete<{ status: string; message: string }>(
        `/admin/option-groups/${groupId}/items/${variantId}`,
      ),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroupItems(vars.groupId) });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

// --- Прив'язка додатків до страви ---

export function useAttachProductOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      payload,
    }: {
      productId: number;
      payload: ProductOptionGroupAttachPayload;
    }) =>
      api.post<ProductOptionGroupAdmin>(`/admin/products/${productId}/option-groups`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

export function useUpdateProductOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      groupId,
      payload,
    }: {
      productId: number;
      groupId: number;
      payload: ProductOptionGroupUpdatePayload;
    }) =>
      api.patch<ProductOptionGroupAdmin>(
        `/admin/products/${productId}/option-groups/${groupId}`,
        payload,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

export function useDetachProductOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, groupId }: { productId: number; groupId: number }) =>
      api.delete<{ status: string; message: string }>(
        `/admin/products/${productId}/option-groups/${groupId}`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

// --- Довідник варіантів для селектора ---

export function useAdminVariantChoices() {
  return useQuery({
    queryKey: keys.adminVariantChoices,
    queryFn: () => api.get<VariantSelectorChoice[]>("/admin/variant-choices"),
  });
}

// --- Налаштування доставки закладів (Адмінка) ---

export function useAdminLocationsDelivery() {
  return useQuery({
    queryKey: keys.adminLocationsDelivery,
    queryFn: () => api.get<LocationDeliverySettings[]>("/admin/locations/delivery"),
  });
}

export function useUpdateLocationDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      locationId,
      payload,
    }: {
      locationId: number;
      payload: LocationDeliveryUpdatePayload;
    }) => api.patch<LocationDeliverySettings>(`/admin/locations/${locationId}/delivery`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminLocationsDelivery });
      void qc.invalidateQueries({ queryKey: keys.locations });
    },
  });
}

// --- Довідник адрес доставки (Клієнтські та Адмінські) ---

export function useDeliveryCities() {
  return useQuery({
    queryKey: keys.deliveryCities,
    queryFn: () => api.get<string[]>("/delivery/cities"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useDeliveryAddresses(city: string = "Вишгород") {
  return useQuery({
    queryKey: keys.deliveryAddresses(city),
    queryFn: () =>
      api.get<DeliveryAddress[]>(`/delivery/addresses?city=${encodeURIComponent(city)}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminDeliveryAddresses(params?: {
  city?: string;
  search?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: keys.adminDeliveryAddresses(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.city) searchParams.append("city", params.city);
      if (params?.search) searchParams.append("search", params.search);
      if (params?.isActive !== undefined) searchParams.append("is_active", String(params.isActive));
      const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
      return api.get<AdminDeliveryAddress[]>(`/admin/delivery/addresses${qs}`);
    },
  });
}

export function useCreateAdminDeliveryAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeliveryAddressCreatePayload) =>
      api.post<AdminDeliveryAddress>("/admin/delivery/addresses", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: ["delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: keys.deliveryCities });
    },
  });
}

export function useUpdateAdminDeliveryAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      addressId,
      payload,
    }: {
      addressId: number;
      payload: DeliveryAddressUpdatePayload;
    }) => api.patch<AdminDeliveryAddress>(`/admin/delivery/addresses/${addressId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: ["delivery", "addresses"] });
    },
  });
}

export function useDeleteAdminDeliveryAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addressId: number) =>
      api.delete<{ status: string; deleted_id: number }>(`/admin/delivery/addresses/${addressId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: ["delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: keys.deliveryCities });
    },
  });
}

// --- Керування користувачами (Адмінка) ---

export function useAdminUsers(query: string = "") {
  return useQuery({
    queryKey: keys.adminUsers(query),
    queryFn: () => {
      const qs = query ? `?query=${encodeURIComponent(query)}` : "";
      return api.get<AdminUser[]>(`/admin/users${qs}`);
    },
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: AdminUserUpdatePayload }) =>
      api.patch<AdminUser>(`/admin/users/${userId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/users/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
}

// --- Керування замовленнями (Адмінка) ---

export function useAdminOrders(params?: { status?: string | null; locationId?: number | null }) {
  return useQuery({
    queryKey: keys.adminOrders(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      if (params?.locationId) sp.set("location_id", String(params.locationId));
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      return api.get<AdminOrderListItem[]>(`/admin/orders${qs}`);
    },
    refetchInterval: 15000,
  });
}

export function useAdminOrderDetail(orderId: number) {
  return useQuery({
    queryKey: keys.adminOrder(orderId),
    queryFn: () => api.get<AdminOrderDetail>(`/admin/orders/${orderId}`),
    enabled: orderId > 0,
  });
}

export function useUpdateAdminOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: AdminOrderUpdatePayload }) =>
      api.put<AdminOrderDetail>(`/admin/orders/${orderId}`, payload),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: keys.adminOrder(vars.orderId) });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: keys.order(vars.orderId) });
    },
  });
}

export function useNotifyAdminOrder() {
  return useMutation({
    mutationFn: (orderId: number) =>
      api.post<{ status: string; message: string }>(`/admin/orders/${orderId}/notify`),
  });
}

// --- Аналітика та статистика замовлень (Адмінка) ---

export function useAdminAnalyticsSummary(params?: { period?: string; locationId?: number | null }) {
  return useQuery({
    queryKey: keys.adminAnalyticsSummary(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.period) sp.set("period", params.period);
      if (params?.locationId) sp.set("location_id", String(params.locationId));
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      return api.get<AnalyticsSummary>(`/admin/analytics/summary${qs}`);
    },
  });
}

export function useAdminAnalyticsTopProducts(params?: {
  period?: string;
  locationId?: number | null;
  limit?: number;
}) {
  return useQuery({
    queryKey: keys.adminAnalyticsTopProducts(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.period) sp.set("period", params.period);
      if (params?.locationId) sp.set("location_id", String(params.locationId));
      if (params?.limit) sp.set("limit", String(params.limit));
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      return api.get<AnalyticsTopProduct[]>(`/admin/analytics/top-products${qs}`);
    },
  });
}

// --- Маркетингові розсилки (Адмінка) ---

export function useAdminBroadcastRecipientsCount(segment: string) {
  return useQuery({
    queryKey: keys.adminBroadcastRecipientsCount(segment),
    queryFn: () =>
      api.get<BroadcastRecipientsCount>(
        `/admin/broadcasts/recipients-count?segment=${encodeURIComponent(segment)}`
      ),
    staleTime: 15000,
  });
}

export function useAdminBroadcasts() {
  return useQuery({
    queryKey: keys.adminBroadcasts,
    queryFn: () => api.get<Broadcast[]>("/admin/broadcasts"),
    refetchInterval: 8000,
  });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BroadcastCreatePayload) =>
      api.post<Broadcast>("/admin/broadcasts", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminBroadcasts });
    },
  });
}

