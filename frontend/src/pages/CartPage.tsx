import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  useCart,
  useClearCart,
  useLocations,
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
  const { data: locations } = useLocations();
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
    <div className="pb-8">
      <ScreenTitle>Кошик</ScreenTitle>

      {/* Підказка при мультилокаційному кошику */}
      {isMultiLocation && (
        <div
          className="app-card mx-4 mb-5 rounded-2xl p-3.5 text-xs leading-relaxed border"
          style={{
            background: "var(--app-tint)",
            borderColor: "color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent)",
          }}
        >
          <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--tg-theme-button-color)" }}>
            <span>🛵</span>
            <span>Замовлення з {locationGroups.length} закладів</span>
          </div>
          <p className="mt-1.5 opacity-85 leading-normal">
            Страви готуються у різних закладах. Доставка здійснюється окремо для кожного закладу (<b>1 заклад = 1 доставка</b>). Оформіть замовлення окремо для кожної локації.
          </p>
        </div>
      )}

      <div className="app-rise space-y-6 px-4">
        {locationGroups.map((group) => {
          const isCroissant = group.locationName.toLowerCase().includes("croissant");
          const locationDetails = locations?.find((l) => l.id === group.locationId);

          return (
            <section key={group.locationId} className="space-y-3">
              {/* Заголовок закладу */}
              <div
                className="flex items-center justify-between pb-2 border-b"
                style={{ borderColor: "var(--app-border)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold flex items-center gap-1.5">
                    <span>{isCroissant ? "🥐" : "🍕"}</span>
                    <span>{group.locationName}</span>
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: "var(--app-surface-2)" }}
                  >
                    {group.items.length} {group.items.length === 1 ? "страва" : "страви"}
                  </span>
                </div>
                <span className="text-sm font-extrabold">{formatPrice(group.subtotal)}</span>
              </div>

              {locationDetails && (
                <div className="flex items-center justify-between text-[11px] opacity-65 -mt-1 px-0.5">
                  <span>
                    Доставка: <b>{locationDetails.delivery_start_time} – {locationDetails.delivery_end_time}</b>
                  </span>
                  {!locationDetails.is_delivery_enabled && (
                    <span className="font-semibold text-rose-500">· Тільки самовивіз</span>
                  )}
                </div>
              )}

              {/* Список страв закладу */}
              <div className="space-y-2.5">
                {group.items.map((item) => (
                  <div key={item.id} className="app-card rounded-2xl p-3.5 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        onClick={() => navigate(`/products/${item.product_id}`)}
                        className="app-press min-w-0 cursor-pointer flex-1"
                      >
                        <p className="truncate font-semibold text-sm flex items-center gap-1.5 hover:underline">
                          <span>{item.product_name}</span>
                          <span className="text-xs opacity-35">↗</span>
                        </p>
                        <p className="mt-0.5 text-xs opacity-60">
                          {item.variant_label}
                          {item.weight && ` · ${item.weight}`}
                        </p>
                        {item.options.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {item.options.map((o) => (
                              <span
                                key={o.variant_id}
                                className="rounded-lg px-2 py-0.5 text-[11px] font-medium"
                                style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
                              >
                                {o.name}{o.qty > 1 ? ` ×${o.qty}` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          haptic("medium");
                          removeItem.mutate(item.id, { onError: () => hapticNotify("error") });
                        }}
                        disabled={busy}
                        className="app-press shrink-0 p-1 text-sm opacity-40 hover:opacity-100 disabled:opacity-20"
                        aria-label={`Видалити ${item.product_name}`}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--app-border)" }}>
                      <div
                        className="flex items-center gap-1.5 rounded-xl px-1.5 py-1"
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
                          className="app-press h-7 w-7 text-base font-bold disabled:opacity-30 flex items-center justify-center rounded-lg"
                          aria-label="Менше"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-bold">{item.qty}</span>
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
                          className="app-press h-7 w-7 text-base font-bold disabled:opacity-30 flex items-center justify-center rounded-lg"
                          aria-label="Більше"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        {item.subtotal / item.qty - item.price > 0.005 && (
                          <p className="text-[10px] opacity-50">
                            +{formatPrice(item.subtotal - item.price * item.qty)} за опції
                          </p>
                        )}
                        <p className="font-extrabold text-sm">{formatPrice(item.subtotal)}</p>
                      </div>
                    </div>

                    {itemErrors[item.id] && (
                      <div
                        className="mt-2.5 rounded-xl p-2.5 text-xs flex flex-col gap-1.5"
                        style={{ background: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444" }}
                      >
                        <p className="leading-relaxed">{itemErrors[item.id]}</p>
                        <button
                          onClick={() => navigate(`/products/${item.product_id}`)}
                          className="app-press self-start font-semibold underline"
                          style={{ color: "var(--tg-theme-link-color)" }}
                        >
                          Налаштувати страву в меню →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Кнопка оформлення замовлення для окремого закладу при мультилокаційному замовленні */}
              {isMultiLocation && (
                <button
                  onClick={() => handleCheckout(group.locationId)}
                  disabled={busy}
                  className="app-press w-full rounded-xl py-3 px-4 text-xs font-bold shadow-md transition-all flex items-center justify-between disabled:opacity-50"
                  style={{
                    background: "var(--tg-theme-button-color)",
                    color: "var(--tg-theme-button-text-color)",
                  }}
                >
                  <span>Оформити замовлення в {group.locationName}</span>
                  <span>{formatPrice(group.subtotal)} →</span>
                </button>
              )}
            </section>
          );
        })}
      </div>

      {/* Підсумок */}
      <div className="mt-8 px-4">
        <div
          className="app-card rounded-2xl p-4 space-y-3"
          style={{ border: "1px solid var(--app-border)" }}
        >
          <div className="flex items-center justify-between text-sm opacity-70">
            <span>Всього страв:</span>
            <span className="font-semibold">{data.items.reduce((s, i) => s + i.qty, 0)} шт</span>
          </div>
          <div className="flex items-center justify-between text-base font-extrabold pt-1 border-t" style={{ borderColor: "var(--app-border)" }}>
            <span>Загальна сума:</span>
            <span className="text-lg text-[var(--tg-theme-button-color)]">{formatPrice(data.total)}</span>
          </div>
        </div>

        {/* Якщо заклад один — головна кнопка чекауту */}
        {!isMultiLocation && locationGroups.length === 1 && (
          <button
            onClick={() => handleCheckout(locationGroups[0].locationId)}
            disabled={busy}
            className="app-press mt-4 w-full rounded-xl py-3.5 font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            <span>Оформити замовлення</span>
            <span>·</span>
            <span>{formatPrice(data.total)}</span>
          </button>
        )}

        <button
          onClick={() => {
            haptic("heavy");
            clearCart.mutate(undefined, { onError: () => hapticNotify("error") });
          }}
          disabled={busy}
          className="app-press mt-3 w-full py-2.5 text-xs font-medium opacity-50 hover:opacity-90 transition disabled:opacity-20"
        >
          Очистити весь кошик
        </button>
      </div>
    </div>
  );
}
