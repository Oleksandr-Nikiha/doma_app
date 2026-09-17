import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAddToCart, useLocations, useProduct } from "@/api/queries";
import { ErrorBox, ProductDetailSkeleton, Thumb, formatPrice } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { isTelegramWebApp } from "@/telegram/env";
import { haptic, hapticNotify } from "@/telegram/sdk";
import type { CartItemOption, OptionGroup, OptionSelection } from "@/api/types";

/** Скільки порцій обрано в групі: ключ — variant_id, значення — кількість. */
type Picks = Record<number, number>;

/**
 * Група, де вибирати нема з чого: треба взяти рівно стільки, скільки є
 * (Хенд-рол СЕТ — усі три соуси). Показуємо як склад, а не як вибір.
 */
function isFixed(group: OptionGroup) {
  return group.min_select >= group.items.length && group.max_select <= group.items.length;
}

function unitsIn(picks: Picks) {
  return Object.values(picks).reduce((sum, n) => sum + n, 0);
}

/**
 * Ефективні межі групи з урахуванням кількості товару в позиції: скільки
 * одиниць товару беремо (qty), стільки разів множаться ліміти й безкоштовна
 * квота. Дзеркалить бекенд (api/src/routers/cart.py): effective_min/max/free = rule * qty.
 */
function effectiveLimits(group: OptionGroup, qty: number) {
  return {
    min: group.min_select * qty,
    max: group.max_select * qty,
    free: group.free_count * qty,
  };
}

/**
 * Вартість опцій групи з урахуванням безкоштовної квоти, помноженої на qty.
 */
function groupCost(group: OptionGroup, picks: Picks, qty: number) {
  const { free } = effectiveLimits(group, qty);
  const units: number[] = [];
  for (const item of group.items) {
    const pickedQty = picks[item.variant_id] ?? 0;
    for (let i = 0; i < pickedQty; i++) units.push(item.price_delta);
  }
  return units
    .sort((a, b) => b - a)
    .slice(free)
    .reduce((sum, price) => sum + price, 0);
}

/** Підказка біля назви групи: скільки брати і що з цього безкоштовно. */
function selectionHint(group: OptionGroup, qty: number) {
  if (isFixed(group)) return "усе включено";

  const { min, max, free } = effectiveLimits(group, qty);

  const need =
    min === max
      ? `оберіть ${min}`
      : min === 0
        ? `до ${max}`
        : `${min}–${max}`;

  if (free === 0) return need;
  const freeLabel = free === 1 ? "перша безкоштовно" : `${free} безкоштовно`;
  return `${need} · ${freeLabel}`;
}

/** Спільний вигляд для «таблеток» розміру й опцій. */
function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--tg-theme-button-color)" : "var(--app-surface)",
    color: active ? "var(--tg-theme-button-text-color)" : "inherit",
    boxShadow: active ? "var(--app-shadow-sm)" : undefined,
    border: active ? "1px solid transparent" : "1px solid var(--app-border)",
  };
}

export function ProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const locationState = state as { location_id?: number; location_name?: string } | undefined;
  const { data: locations } = useLocations();
  useBackButton();

  const { data, isPending, error, refetch } = useProduct(Number(productId));
  const addToCart = useAddToCart();

  const [variantId, setVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [picked, setPicked] = useState<Record<number, Picks>>({});
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  if (isPending) return <ProductDetailSkeleton />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  const selected = data.variants.find((v) => v.id === variantId) ?? data.variants[0];

  const picksFor = (group: OptionGroup): Picks => {
    if (picked[group.group_id] !== undefined) {
      return picked[group.group_id];
    }
    if (isFixed(group)) {
      return Object.fromEntries(group.items.map((i) => [i.variant_id, qty]));
    }
    // Для груп з одним товаром і безкоштовною квотою (наприклад, Васабі, Імбир)
    // за замовчуванням підставляємо включену безкоштовну кількість
    if (group.items.length === 1 && group.free_count > 0) {
      return { [group.items[0].variant_id]: group.free_count * qty };
    }
    return {};
  };

  function setPicks(group: OptionGroup, next: Picks) {
    setShowErrors(false);
    setPicked((prev) => ({ ...prev, [group.group_id]: next }));
  }

  function pickOne(group: OptionGroup, optionVariantId: number) {
    const current = picksFor(group);
    haptic("light");
    setPicks(group, current[optionVariantId] ? {} : { [optionVariantId]: 1 });
  }

  function changeQty(group: OptionGroup, optionVariantId: number, delta: number) {
    const current = picksFor(group);
    const { max } = effectiveLimits(group, qty);

    if (delta > 0 && unitsIn(current) >= max) {
      hapticNotify("warning");
      return;
    }

    const next = { ...current };
    const value = (next[optionVariantId] ?? 0) + delta;
    if (value <= 0) delete next[optionVariantId];
    else next[optionVariantId] = value;

    haptic("light");
    setPicks(group, next);
  }

  const unfilled = data.option_groups.filter(
    (g) => unitsIn(picksFor(g)) < effectiveLimits(g, qty).min,
  );
  const overLimit = data.option_groups.filter(
    (g) => unitsIn(picksFor(g)) > effectiveLimits(g, qty).max,
  );
  const canAdd = Boolean(selected) && unfilled.length === 0 && overLimit.length === 0;

  const optionsDelta = data.option_groups.reduce(
    (sum, g) => sum + groupCost(g, picksFor(g), qty),
    0,
  );
  const total = selected ? selected.price * qty + optionsDelta : 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-[var(--tg-theme-bg-color)]">
      {/* Скролована частина зі стравою та опціями */}
      <div className="flex-1 pb-6">
        <div className="relative overflow-hidden">
          {!isTelegramWebApp() && (
            <button
              type="button"
              onClick={() => void navigate(-1)}
              className="app-press absolute left-3.5 top-3.5 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform active:scale-95 shadow-md"
              aria-label="Назад"
            >
              ←
            </button>
          )}
          <Thumb src={data.image_url} rounded="" className="aspect-[4/3] w-full text-6xl" eager />
          <div
            className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
            style={{
              background: "linear-gradient(to top, var(--tg-theme-bg-color), transparent)",
            }}
          />
        </div>

        <div className="px-4" ref={optionsContainerRef}>
          <div className="app-rise pt-3">
            <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
            {data.description && (
              <p className="mt-2 text-sm leading-relaxed opacity-70">{data.description}</p>
            )}
          </div>

          {data.variants.length > 0 && (
            <div className="app-rise mt-5">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider opacity-50">
                Варіант / Розмір
              </p>
              <div className="flex flex-wrap gap-2">
                {data.variants.map((v) => {
                  const active = v.id === selected?.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        haptic("light");
                        setVariantId(v.id);
                      }}
                      className="app-press rounded-xl px-3.5 py-2.5 text-left text-sm transition-all"
                      style={chipStyle(active)}
                    >
                      <span className="font-semibold">{v.label}</span>
                      {v.weight && <span className="ml-2 text-xs opacity-65">{v.weight}</span>}
                      <span className="ml-2.5 font-bold">{formatPrice(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {data.option_groups.map((group) => {
            const picks = picksFor(group);
            const fixed = isFixed(group);
            const { min: effMin, max: effMax } = effectiveLimits(group, qty);
            const multi = !fixed && effMax > 1;
            const currentUnits = unitsIn(picks);
            const isUnfilled = !fixed && currentUnits < effMin;
            const isFilled = !fixed && effMin > 0 && currentUnits >= effMin;
            const isUrgentNotice = isUnfilled && showErrors;

            return (
              <div
                key={group.group_id}
                className={`app-rise rounded-2xl transition-all p-3.5 mt-4 ${
                  isUrgentNotice
                    ? "ring-2 ring-amber-500/50"
                    : isUnfilled && effMin > 0
                      ? ""
                      : ""
                }`}
                style={{
                  background: isUrgentNotice
                    ? "color-mix(in srgb, #f59e0b 8%, var(--app-surface))"
                    : "var(--app-surface)",
                  border: isUrgentNotice
                    ? "1px solid color-mix(in srgb, #f59e0b 40%, transparent)"
                    : "1px solid var(--app-border)",
                  boxShadow: "var(--app-shadow-sm)",
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold tracking-tight">{group.name}</p>
                    {isFilled ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide flex items-center gap-1"
                        style={{
                          background: "color-mix(in srgb, #22c55e 14%, transparent)",
                          color: "#22c55e",
                        }}
                      >
                        ✓ Обрано
                      </span>
                    ) : isUrgentNotice ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
                        style={{
                          background: "color-mix(in srgb, #f59e0b 20%, transparent)",
                          color: "#d97706",
                        }}
                      >
                        Оберіть варіант
                      </span>
                    ) : effMin > 0 ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
                        style={{
                          background: "var(--app-tint)",
                          color: "var(--tg-theme-button-color)",
                        }}
                      >
                        Обов'язково
                      </span>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs opacity-60">
                    {selectionHint(group, qty)}
                  </p>
                </div>

                {multi ? (
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const count = picks[item.variant_id] ?? 0;
                      return (
                        <div
                          key={item.variant_id}
                          className="flex items-center gap-3 rounded-xl px-3 py-2 transition-all"
                          style={{
                            background: count > 0 ? "var(--app-surface-2)" : "transparent",
                            border: "1px solid var(--app-border)",
                          }}
                        >
                          <span className={`flex-1 text-sm ${count ? "font-semibold" : ""}`}>
                            {item.name}
                          </span>
                          {item.price_delta > 0 && (
                            <span className="text-xs font-medium opacity-65">
                              +{formatPrice(item.price_delta)}
                            </span>
                          )}
                          <div
                            className="flex items-center gap-1.5 rounded-lg px-1 py-0.5"
                            style={{ background: "var(--app-surface-2)" }}
                          >
                            <button
                              onClick={() => changeQty(group, item.variant_id, -1)}
                              disabled={count === 0}
                              className="app-press h-7 w-7 text-base font-bold disabled:opacity-20 flex items-center justify-center rounded-lg"
                              aria-label={`Менше: ${item.name}`}
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-xs font-bold">{count}</span>
                            <button
                              onClick={() => changeQty(group, item.variant_id, 1)}
                              className="app-press h-7 w-7 text-base font-bold flex items-center justify-center rounded-lg"
                              aria-label={`Більше: ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => {
                      const active = Boolean(picks[item.variant_id]);
                      return (
                        <button
                          key={item.variant_id}
                          disabled={fixed}
                          onClick={() => pickOne(group, item.variant_id)}
                          className={`rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-100 transition-all ${
                            fixed ? "" : "app-press"
                          }`}
                          style={chipStyle(active)}
                        >
                          {active && (
                            <span className="app-pop mr-1.5 inline-block text-[11px]" aria-hidden>
                              ✓
                            </span>
                          )}
                          <span>{item.name}</span>
                          {item.price_delta > 0 && (
                            <span className="ml-2 opacity-75">+{formatPrice(item.price_delta)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Фіксована плаваюча панель дії внизу */}
      <div
        className="sticky bottom-0 z-30 app-glass border-t p-4"
        style={{
          borderColor: "var(--app-border)",
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
          boxShadow: "0 -4px 16px -4px rgb(0 0 0 / 8%)",
        }}
      >
        {addToCart.isError && (
          <p className="mb-2 text-center text-xs font-semibold text-rose-500">
            {addToCart.error.message}
          </p>
        )}

        {unfilled.length > 0 && showErrors && (
          <p className="mb-2.5 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
            Будь ласка, оберіть: {unfilled.map((g) => g.name.toLowerCase()).join(", ")}
          </p>
        )}

        <div className="flex items-center gap-3">
          {/* Лічильник кількості порцій */}
          <div
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 shrink-0"
            style={{ background: "var(--app-surface-2)", border: "1px solid var(--app-border)" }}
          >
            <button
              onClick={() => {
                haptic("light");
                setQty((q) => Math.max(1, q - 1));
              }}
              disabled={qty <= 1}
              className="app-press h-8 w-8 text-lg font-bold disabled:opacity-25 flex items-center justify-center rounded-lg"
              aria-label="Менше"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-bold">{qty}</span>
            <button
              onClick={() => {
                haptic("light");
                setQty((q) => q + 1);
              }}
              className="app-press h-8 w-8 text-lg font-bold flex items-center justify-center rounded-lg"
              aria-label="Більше"
            >
              +
            </button>
          </div>

          {/* Головна кнопка додавання */}
          <button
            disabled={addToCart.isPending}
            onClick={() => {
              if (!canAdd) {
                setShowErrors(true);
                hapticNotify("warning");
                return;
              }
              if (!selected) return;
              const options: OptionSelection[] = data.option_groups.flatMap((g) =>
                Object.entries(picksFor(g))
                  .filter(([_, optionQty]) => optionQty > 0)
                  .map(([optionVariantId, optionQty]) => ({
                    group_id: g.group_id,
                    variant_id: Number(optionVariantId),
                    qty: optionQty,
                  })),
              );
              const optionsDetails: CartItemOption[] = [];
              const groupFreeCount: Record<number, number> = {};

              for (const g of data.option_groups) {
                groupFreeCount[g.group_id] = g.free_count;
                const picks = picksFor(g);
                for (const item of g.items) {
                  const pickedQty = picks[item.variant_id] ?? 0;
                  if (pickedQty > 0) {
                    optionsDetails.push({
                      group_id: g.group_id,
                      variant_id: item.variant_id,
                      name: item.name,
                      label: "порція",
                      price_delta: item.price_delta,
                      qty: pickedQty,
                    });
                  }
                }
              }

              const locId = locationState?.location_id ?? 1;
              const locName =
                locationState?.location_name ??
                locations?.find((l) => l.id === locId)?.name ??
                "Doma Pizza";

              addToCart.mutate(
                {
                  variant_id: selected.id,
                  qty,
                  options,
                  guest_meta: {
                    product_id: data.id,
                    product_name: data.name,
                    variant_label: selected.label,
                    weight: selected.weight,
                    price: selected.price,
                    location_id: locId,
                    location_name: locName,
                    options_details: optionsDetails,
                    group_free_count: groupFreeCount,
                  },
                },
                {
                  onSuccess: () => {
                    hapticNotify("success");
                    void navigate("/cart");
                  },
                  onError: () => hapticNotify("error"),
                },
              );
            }}
            className="app-press flex-1 rounded-xl py-3.5 px-4 font-bold text-sm shadow-md transition-all flex items-center justify-between"
            style={
              canAdd
                ? {
                    background: "var(--tg-theme-button-color)",
                    color: "var(--tg-theme-button-text-color)",
                    boxShadow: "var(--app-shadow)",
                  }
                : {
                    background: "var(--app-surface-2)",
                    color: "inherit",
                    opacity: 0.8,
                  }
            }
          >
            <span>{addToCart.isPending ? "Додаємо…" : "В кошик"}</span>
            <span className="font-extrabold">{formatPrice(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
