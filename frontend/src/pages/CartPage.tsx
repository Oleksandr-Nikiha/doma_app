import {
  useCart,
  useClearCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from "@/api/queries";
import { EmptyState, ErrorBox, ScreenTitle, Spinner, formatPrice } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function CartPage() {
  const { data, isPending, error, refetch } = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
  if (data.items.length === 0) {
    return <EmptyState icon="🛒" title="Кошик порожній" hint="Оберіть щось смачне у вкладці «Меню»" />;
  }

  // Поки триває будь-яка мутація — блокуємо кнопки, щоб подвійний тап
  // не відправив дві зміни кількості поспіль
  const busy = updateItem.isPending || removeItem.isPending || clearCart.isPending;

  return (
    <div className="pb-4">
      <ScreenTitle>Кошик</ScreenTitle>

      <div className="app-rise space-y-3 px-4">
        {data.items.map((item) => (
          <div
            key={item.id}
            className="app-card rounded-2xl p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.product_name}</p>
                <p className="mt-0.5 text-sm opacity-60">
                  {item.variant_label}
                  {item.weight && ` · ${item.weight}`}
                </p>
                {/* Саме опції відрізняють два однакові з вигляду бокси —
                    без цього рядка їх у кошику не розрізнити. Мітку варіанта
                    («порція», «0.5 л») не показуємо: розмір уже заданий групою. */}
                {item.options.length > 0 && (
                  <p
                    className="mt-1 inline-block rounded-lg px-2 py-1 text-xs"
                    style={{ background: "var(--app-tint)", color: "var(--tg-theme-link-color)" }}
                  >
                    {item.options
                      .map((o) => (o.price_delta > 0 ? `${o.name} +${formatPrice(o.price_delta)}` : o.name))
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
              <div className="flex items-center gap-3 rounded-xl px-2 py-1" style={{ background: "var(--app-surface-2)" }}>
                <button
                  onClick={() => {
                    haptic("light");
                    // qty=0 бекенд не приймає (CHECK qty>0) — на одиниці видаляємо позицію
                    if (item.qty <= 1) removeItem.mutate(item.id);
                    else updateItem.mutate({ itemId: item.id, qty: item.qty - 1 });
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
                    updateItem.mutate({ itemId: item.id, qty: item.qty + 1 });
                  }}
                  disabled={busy}
                  className="app-press h-7 w-7 text-lg font-bold disabled:opacity-30"
                  aria-label="Більше"
                >
                  +
                </button>
              </div>
              <p className="font-semibold">{formatPrice(item.subtotal)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 px-4">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Разом</span>
          <span>{formatPrice(data.total)}</span>
        </div>

        <button
          disabled
          className="mt-4 w-full rounded-xl py-3 font-semibold opacity-40"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
          title="Оформлення замовлення буде у наступній версії"
        >
          Оформити — скоро
        </button>

        <button
          onClick={() => {
            haptic("heavy");
            clearCart.mutate(undefined, { onError: () => hapticNotify("error") });
          }}
          disabled={busy}
          className="app-press mt-2 w-full py-3 text-sm font-medium opacity-60 disabled:opacity-30"
        >
          Очистити кошик
        </button>
      </div>
    </div>
  );
}
