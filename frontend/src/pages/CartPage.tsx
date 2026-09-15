import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  useCart,
  useClearCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from "@/api/queries";
import type { CartItem } from "@/api/types";
import { EmptyState, ErrorBox, ScreenTitle, Spinner, formatPrice } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

interface LocationGroup {
  locationId: number;
  locationName: string;
  items: CartItem[];
  subtotal: number;
}

export function CartPage() {
  const navigate = useNavigate();
  const { data, isPending, error, refetch } = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();

  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

  const clearItemError = (itemId: number) =>
    setItemErrors((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

  const setItemError = (itemId: number, err: unknown) => {
    hapticNotify("error");
    setItemErrors((prev) => ({
      ...prev,
      [itemId]: err instanceof ApiError ? err.detail : "Не вдалося оновити кількість",
    }));
  };

  // Групуємо позиції кошика за закладом
  const locationGroups: LocationGroup[] = useMemo(() => {
    if (!data?.items?.length) return [];
    const map = new Map<number, LocationGroup>();

    for (const item of data.items) {
      let grp = map.get(item.location_id);
      if (!grp) {
        grp = {
          locationId: item.location_id,
          locationName: item.location_name,
          items: [],
          subtotal: 0,
        };
        map.set(item.location_id, grp);
      }
      grp.items.push(item);
      grp.subtotal += item.subtotal;
    }

    return Array.from(map.values()).map((g) => ({
      ...g,
      subtotal: Math.round(g.subtotal * 100) / 100,
    }));
  }, [data]);

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return <EmptyState icon="🛒" title="Кошик порожній" hint="Оберіть щось смачне у вкладці «Меню»" />;
  }

  const busy = updateItem.isPending || removeItem.isPending || clearCart.isPending;
  const isMultiLocation = locationGroups.length > 1;

  const handleCheckout = (locationId: number) => {
    haptic("light");
    navigate(`/checkout?locationId=${locationId}`);
  };

  return (
    <div className="pb-6">
      <ScreenTitle>Кошик</ScreenTitle>

      {/* Підказка при мультилокаційному кошику */}
      {isMultiLocation && (
        <div className="mx-4 mb-4 rounded-xl p-3 text-xs leading-relaxed" style={{ background: "var(--app-tint)", color: "var(--tg-theme-link-color)" }}>
          💡 <b>Страви з різних закладів</b>
          <p className="mt-1 opacity-90">
            У вашому кошику є позиції з {locationGroups.length} закладів. Замовлення оформлюються окремо для кожного закладу.
          </p>
        </div>
      )}

      <div className="app-rise space-y-6 px-4">
        {locationGroups.map((group) => (
          <section key={group.locationId} className="space-y-3">
            {/* Заголовок закладу */}
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--app-border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">📍 {group.locationName}</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--app-surface-2)" }}>
                  {group.items.length} {group.items.length === 1 ? "страва" : "страви"}
                </span>
              </div>
              <span className="text-sm font-semibold">{formatPrice(group.subtotal)}</span>
            </div>

            {/* Список страв закладу */}
            <div className="space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="app-card rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.product_name}</p>
                      <p className="mt-0.5 text-sm opacity-60">
                        {item.variant_label}
                        {item.weight && ` · ${item.weight}`}
                      </p>
                      {item.options.length > 0 && (
                        <p
                          className="mt-1 inline-block rounded-lg px-2 py-1 text-xs"
                          style={{ background: "var(--app-tint)", color: "var(--tg-theme-link-color)" }}
                        >
                          {item.options
                            .map((o) => (o.qty > 1 ? `${o.name} ×${o.qty}` : o.name))
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        haptic("medium");
                        removeItem.mutate(item.id, { onError: () => hapticNotify("error") });
                      }}
                      disabled={busy}
                      className="app-press shrink-0 px-1 text-lg opacity-50 disabled:opacity-20"
                      aria-label={`Видалити ${item.product_name}`}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 rounded-xl px-2 py-1"
                      style={{ background: "var(--app-surface-2)" }}
                    >
                      <button
                        onClick={() => {
                          haptic("light");
                          if (item.qty <= 1) {
                            removeItem.mutate(item.id, { onError: () => hapticNotify("error") });
                            return;
                          }
                          updateItem.mutate(
                            { itemId: item.id, qty: item.qty - 1 },
                            {
                              onError: (err) => setItemError(item.id, err),
                              onSuccess: () => clearItemError(item.id),
                            },
                          );
                        }}
                        disabled={busy}
                        className="app-press h-7 w-7 text-lg font-bold disabled:opacity-30"
                        aria-label="Менше"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{item.qty}</span>
                      <button
                        onClick={() => {
                          haptic("light");
                          updateItem.mutate(
                            { itemId: item.id, qty: item.qty + 1 },
                            {
                              onError: (err) => setItemError(item.id, err),
                              onSuccess: () => clearItemError(item.id),
                            },
                          );
                        }}
                        disabled={busy}
                        className="app-press h-7 w-7 text-lg font-bold disabled:opacity-30"
                        aria-label="Більше"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      {item.subtotal / item.qty - item.price > 0.005 && (
                        <p className="text-xs opacity-50">
                          +{formatPrice(item.subtotal - item.price * item.qty)} за опції
                        </p>
                      )}
                      <p className="font-semibold">{formatPrice(item.subtotal)}</p>
                    </div>
                  </div>

                  {itemErrors[item.id] && (
                    <p
                      className="mt-2 rounded-lg px-3 py-2 text-xs"
                      style={{ background: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444" }}
                    >
                      {itemErrors[item.id]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Якщо кілька локацій — окрема кнопка оформлення для цієї локації */}
            {isMultiLocation && (
              <button
                onClick={() => handleCheckout(group.locationId)}
                disabled={busy}
                className="app-press w-full rounded-xl py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-50"
                style={{
                  background: "var(--tg-theme-button-color)",
                  color: "var(--tg-theme-button-text-color)",
                }}
              >
                Оформити в {group.locationName} — {formatPrice(group.subtotal)}
              </button>
            )}
          </section>
        ))}
      </div>

      {/* Підсумок */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Загалом</span>
          <span>{formatPrice(data.total)}</span>
        </div>

        {/* Якщо заклад один — головна кнопка чекауту */}
        {!isMultiLocation && locationGroups.length === 1 && (
          <button
            onClick={() => handleCheckout(locationGroups[0].locationId)}
            disabled={busy}
            className="app-press mt-4 w-full rounded-xl py-3 font-semibold shadow transition disabled:opacity-50"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            Оформити замовлення — {formatPrice(data.total)}
          </button>
        )}

        <button
          onClick={() => {
            haptic("heavy");
            clearCart.mutate(undefined, { onError: () => hapticNotify("error") });
          }}
          disabled={busy}
          className="app-press mt-3 w-full py-2.5 text-sm font-medium opacity-60 transition hover:opacity-100 disabled:opacity-30"
        >
          Очистити весь кошик
        </button>
      </div>
    </div>
  );
}
