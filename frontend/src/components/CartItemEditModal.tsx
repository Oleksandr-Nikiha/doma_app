import { useMemo, useState } from "react";

import { useProduct, useUpdateCartItem } from "@/api/queries";
import type { CartItem, CartItemOption, OptionGroup, OptionSelection } from "@/api/types";
import { ErrorBox, Spinner, formatPrice } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

interface CartItemEditModalProps {
  item: CartItem;
  onClose: () => void;
}

type Picks = Record<number, number>;

function isFixed(group: OptionGroup) {
  return group.min_select >= group.items.length && group.max_select <= group.items.length;
}

function unitsIn(picks: Picks) {
  return Object.values(picks).reduce((sum, n) => sum + n, 0);
}

function effectiveLimits(group: OptionGroup, qty: number) {
  return {
    min: group.min_select * qty,
    max: group.max_select * qty,
    free: group.free_count * qty,
  };
}

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

function selectionHint(group: OptionGroup, qty: number) {
  if (isFixed(group)) return "усе включено";

  const { min, max, free } = effectiveLimits(group, qty);

  const need =
    min === max
      ? `оберіть ${min}`
      : min === 0
        ? `до ${max} (необовʼязково)`
        : `${min}–${max}`;

  if (free === 0 || free >= max) return need;
  const freeLabel = free === 1 ? "перша безкоштовно" : `${free} безкоштовно`;
  return `${need} · ${freeLabel}`;
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--tg-theme-button-color)" : "var(--app-surface)",
    color: active ? "var(--tg-theme-button-text-color)" : "inherit",
    boxShadow: active ? "var(--app-shadow-sm)" : undefined,
    border: active ? "1px solid transparent" : "1px solid var(--app-border)",
  };
}

export function CartItemEditModal({ item, onClose }: CartItemEditModalProps) {
  const { data: product, isPending, error, refetch } = useProduct(item.product_id);
  const updateItem = useUpdateCartItem();

  // Початковий вибір варіанта
  const [variantId, setVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(item.qty);
  const [showErrors, setShowErrors] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ініціалізація вибору опцій з поточної позиції кошика
  const initialPicks = useMemo(() => {
    const map: Record<number, Picks> = {};
    for (const opt of item.options) {
      if (!map[opt.group_id]) {
        map[opt.group_id] = {};
      }
      map[opt.group_id][opt.variant_id] = opt.qty;
    }
    return map;
  }, [item.options]);

  const [picked, setPicked] = useState<Record<number, Picks>>(initialPicks);

  if (isPending) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <div
          className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl"
          style={{ background: "var(--tg-theme-bg-color, #ffffff)" }}
        >
          <Spinner />
          <p className="mt-3 text-xs opacity-60">Завантаження параметрів страви…</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div
          className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
          style={{ background: "var(--tg-theme-bg-color, #ffffff)" }}
        >
          <ErrorBox message={error?.message ?? "Не вдалося завантажити товар"} onRetry={() => void refetch()} />
          <button
            onClick={onClose}
            className="app-press mt-4 w-full py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: "var(--app-surface-2)" }}
          >
            Закрити
          </button>
        </div>
      </div>
    );
  }

  const selectedVariant =
    product.variants.find((v) => v.id === (variantId ?? undefined)) ??
    product.variants.find((v) => v.label === item.variant_label) ??
    product.variants[0];

  const picksFor = (group: OptionGroup): Picks => {
    if (picked[group.group_id] !== undefined) {
      return picked[group.group_id];
    }
    if (isFixed(group)) {
      return Object.fromEntries(group.items.map((i) => [i.variant_id, qty]));
    }
    return {};
  };

  function setGroupPicks(group: OptionGroup, next: Picks) {
    setShowErrors(false);
    setErrorMessage(null);
    setPicked((prev) => ({ ...prev, [group.group_id]: next }));
  }

  function pickOne(group: OptionGroup, optionVariantId: number) {
    const current = picksFor(group);
    haptic("light");
    // Якщо група вимагає хоча б 1 вибір і цей елемент вже обраний — не скидаємо
    if (current[optionVariantId] && group.min_select >= 1) {
      return;
    }
    // Якщо необов'язкова група і елемент вже обраний — клік знімає вибір (прибирає соус)
    if (current[optionVariantId]) {
      setGroupPicks(group, {});
      return;
    }
    // Інакше обираємо цей варіант
    setGroupPicks(group, { [optionVariantId]: 1 });
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
    if (value <= 0) {
      delete next[optionVariantId];
    } else {
      next[optionVariantId] = value;
    }

    haptic("light");
    setGroupPicks(group, next);
  }

  const unfilled = product.option_groups.filter(
    (g) => unitsIn(picksFor(g)) < effectiveLimits(g, qty).min,
  );
  const overLimit = product.option_groups.filter(
    (g) => unitsIn(picksFor(g)) > effectiveLimits(g, qty).max,
  );
  const canSave = Boolean(selectedVariant) && unfilled.length === 0 && overLimit.length === 0;

  const optionsDelta = product.option_groups.reduce(
    (sum, g) => sum + groupCost(g, picksFor(g), qty),
    0,
  );
  const total = selectedVariant ? selectedVariant.price * qty + optionsDelta : 0;

  const handleSave = () => {
    if (!canSave) {
      hapticNotify("warning");
      setShowErrors(true);
      return;
    }

    const options: OptionSelection[] = [];
    const optionsDetails: CartItemOption[] = [];
    const groupFreeCount: Record<number, number> = {};

    for (const g of product.option_groups) {
      groupFreeCount[g.group_id] = g.free_count;
      const groupPicks = picksFor(g);
      for (const optItem of g.items) {
        const pickedCount = groupPicks[optItem.variant_id] ?? 0;
        if (pickedCount > 0) {
          options.push({
            group_id: g.group_id,
            variant_id: optItem.variant_id,
            qty: pickedCount,
          });
          optionsDetails.push({
            group_id: g.group_id,
            variant_id: optItem.variant_id,
            name: optItem.name,
            label: "порція",
            price_delta: optItem.price_delta,
            qty: pickedCount,
          });
        }
      }
    }

    updateItem.mutate(
      {
        itemId: item.id,
        variant_id: selectedVariant.id,
        qty,
        options,
        guest_meta: {
          variant_label: selectedVariant.label,
          weight: selectedVariant.weight,
          price: selectedVariant.price,
          options_details: optionsDetails,
          group_free_count: groupFreeCount,
        },
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
        onError: (err) => {
          hapticNotify("error");
          setErrorMessage(err instanceof Error ? err.message : "Не вдалося зберегти зміни");
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        style={{
          background: "var(--tg-theme-bg-color, #ffffff)",
          color: "var(--tg-theme-text-color, #000000)",
        }}
      >
        {/* Заголовок модального вікна */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3 border-b"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div className="min-w-0 pr-3">
            <h2 className="text-base font-bold truncate">{item.product_name}</h2>
            <p className="text-xs opacity-60">Налаштування соусів, напоїв та опцій</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-press h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold opacity-60 hover:opacity-100 shrink-0"
            style={{ background: "var(--app-surface-2)" }}
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        {/* Скролована частина з групами опцій */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Вибір варіанта / розміру, якщо їх декілька */}
          {product.variants.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider opacity-60">Варіант</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const active = v.id === selectedVariant?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        haptic("light");
                        setVariantId(v.id);
                      }}
                      className="app-press rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition-all"
                      style={chipStyle(active)}
                    >
                      <span>{v.label}</span>
                      {v.weight && <span className="ml-1.5 opacity-65">{v.weight}</span>}
                      <span className="ml-2 font-bold">{formatPrice(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Групи опцій (Соуси, Напої тощо) */}
          {product.option_groups.length === 0 ? (
            <div className="p-4 rounded-xl text-center text-xs opacity-60" style={{ background: "var(--app-surface)" }}>
              Для цієї позиції немає додаткових опцій чи соусів.
            </div>
          ) : (
            product.option_groups.map((group) => {
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
                  className="rounded-2xl p-4 transition-all"
                  style={{
                    background: "var(--app-surface)",
                    border: isUrgentNotice ? "1.5px solid #ef4444" : "1px solid var(--app-border)",
                  }}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <p className="text-sm font-bold tracking-tight">{group.name}</p>
                      {!fixed && isFilled ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide inline-flex items-center gap-1 shrink-0"
                          style={{
                            background: "color-mix(in srgb, #22c55e 14%, transparent)",
                            color: "#22c55e",
                          }}
                        >
                          ✓ Обрано
                        </span>
                      ) : !fixed && isUrgentNotice ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shrink-0"
                          style={{
                            background: "color-mix(in srgb, #f59e0b 20%, transparent)",
                            color: "#d97706",
                          }}
                        >
                          Оберіть варіант
                        </span>
                      ) : !fixed && effMin > 0 ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shrink-0"
                          style={{
                            background: "var(--app-tint)",
                            color: "var(--tg-theme-button-color)",
                          }}
                        >
                          Обовʼязково
                        </span>
                      ) : null}
                    </div>

                    <span className="text-[11px] opacity-60 shrink-0">{selectionHint(group, qty)}</span>
                  </div>

                  {multi ? (
                    <div className="space-y-2">
                      {group.items.map((optItem) => {
                        const count = picks[optItem.variant_id] ?? 0;
                        return (
                          <div
                            key={optItem.variant_id}
                            className="flex items-center justify-between rounded-xl px-3 py-2"
                            style={{ background: "var(--app-surface-2)" }}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-semibold truncate">{optItem.name}</p>
                              {optItem.price_delta > 0 && (
                                <p className="text-[11px] opacity-60">+{formatPrice(optItem.price_delta)}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={count === 0}
                                onClick={() => changeQty(group, optItem.variant_id, -1)}
                                className="app-press h-7 w-7 rounded-lg text-sm font-bold flex items-center justify-center disabled:opacity-30"
                                style={{ background: "var(--app-surface-3)" }}
                              >
                                −
                              </button>
                              <span className="w-5 text-center text-xs font-bold">{count}</span>
                              <button
                                type="button"
                                disabled={currentUnits >= effMax}
                                onClick={() => changeQty(group, optItem.variant_id, 1)}
                                className="app-press h-7 w-7 rounded-lg text-sm font-bold flex items-center justify-center disabled:opacity-30"
                                style={{ background: "var(--app-surface-3)" }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {group.items.map((optItem) => {
                        const active = Boolean(picks[optItem.variant_id]);
                        return (
                          <button
                            key={optItem.variant_id}
                            type="button"
                            disabled={fixed}
                            onClick={() => pickOne(group, optItem.variant_id)}
                            className={`inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-100 transition-all ${
                              fixed ? "" : "app-press"
                            }`}
                            style={chipStyle(active)}
                          >
                            <span>{optItem.name}</span>
                            {optItem.price_delta > 0 && (
                              <span className="ml-1.5 opacity-70">+{formatPrice(optItem.price_delta)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {!fixed && group.min_select === 0 && currentUnits > 0 && !multi && (
                    <button
                      type="button"
                      onClick={() => setGroupPicks(group, {})}
                      className="mt-2 text-[11px] font-medium opacity-65 underline app-press"
                    >
                      Прибрати вибір
                    </button>
                  )}
                </div>
              );
            })
          )}

          {/* Кількість порцій */}
          <div
            className="flex items-center justify-between rounded-2xl p-3.5"
            style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
          >
            <div>
              <p className="text-xs font-bold">Кількість</p>
              <p className="text-[11px] opacity-60">Порцій цієї позиції</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl p-1" style={{ background: "var(--app-surface-2)" }}>
              <button
                type="button"
                disabled={qty <= 1}
                onClick={() => {
                  haptic("light");
                  setQty((q) => Math.max(1, q - 1));
                }}
                className="app-press h-7 w-7 rounded-lg text-sm font-bold flex items-center justify-center disabled:opacity-30"
              >
                −
              </button>
              <span className="w-5 text-center text-xs font-bold">{qty}</span>
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  setQty((q) => q + 1);
                }}
                className="app-press h-7 w-7 rounded-lg text-sm font-bold flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          {errorMessage && (
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: "color-mix(in srgb, #ef4444 14%, transparent)", color: "#ef4444" }}
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Нижня панель дій */}
        <div
          className="p-4 border-t flex items-center gap-3"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="app-press rounded-xl py-3 px-4 text-xs font-semibold shrink-0"
            style={{ background: "var(--app-surface-2)" }}
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateItem.isPending}
            className="app-press flex-1 rounded-xl py-3 px-4 font-bold text-xs shadow-md flex items-center justify-between transition-all disabled:opacity-50"
            style={{
              background: canSave ? "var(--tg-theme-button-color)" : "var(--app-surface-2)",
              color: canSave ? "var(--tg-theme-button-text-color)" : "inherit",
            }}
          >
            <span>{updateItem.isPending ? "Зберігаємо…" : "Зберегти зміни"}</span>
            <span className="font-extrabold">{formatPrice(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

