import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAddToCart, useProduct } from "@/api/queries";
import { ErrorBox, Spinner, Thumb, formatPrice } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic, hapticNotify } from "@/telegram/sdk";
import type { OptionGroup } from "@/api/types";

/**
 * Група, де вибирати нема з чого: треба взяти рівно стільки, скільки є
 * (Хенд-рол СЕТ — усі три соуси). Показуємо як склад, а не як вибір.
 */
function isFixed(group: OptionGroup) {
  return group.min_select >= group.items.length;
}

/** Підказка біля назви групи: скільки позицій очікується. */
function selectionHint(group: OptionGroup) {
  if (isFixed(group)) return "усе включено";
  if (group.min_select === group.max_select) return `оберіть ${group.min_select}`;
  if (group.min_select === 0) return `до ${group.max_select}`;
  return `${group.min_select}–${group.max_select}`;
}

/** Спільний вигляд для «таблеток» розміру й опцій. */
function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--tg-theme-button-color)" : "var(--app-surface)",
    color: active ? "var(--tg-theme-button-text-color)" : "inherit",
    boxShadow: active ? "var(--app-shadow)" : undefined,
  };
}

export function ProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  useBackButton();

  const { data, isPending, error, refetch } = useProduct(Number(productId));
  const addToCart = useAddToCart();

  // null = ще не обрано; після завантаження підставляємо перший варіант
  const [variantId, setVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  // Вибір опцій за group_id. Групи, яких тут немає, беруть значення за
  // замовчуванням — так стан лишається коректним і до завантаження даних,
  // без useEffect на підстановку.
  const [picked, setPicked] = useState<Record<number, number[]>>({});

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  const selected = data.variants.find((v) => v.id === variantId) ?? data.variants[0];

  const selectionFor = (group: OptionGroup): number[] =>
    picked[group.group_id] ?? (isFixed(group) ? group.items.map((i) => i.variant_id) : []);

  function toggleOption(group: OptionGroup, optionVariantId: number) {
    const current = selectionFor(group);
    let next: number[];

    if (current.includes(optionVariantId)) {
      next = current.filter((id) => id !== optionVariantId);
    } else if (group.max_select === 1) {
      next = [optionVariantId]; // одиночний вибір — заміщуємо
    } else if (current.length < group.max_select) {
      next = [...current, optionVariantId];
    } else {
      hapticNotify("warning"); // ліміт групи вичерпано
      return;
    }

    haptic("light");
    setPicked((prev) => ({ ...prev, [group.group_id]: next }));
  }

  // Бекенд перевіряє ті самі межі й віддає 400 — тут дублюємо, щоб не
  // ганяти завідомо невалідний запит і одразу пояснити, чого бракує.
  const unfilled = data.option_groups.filter((g) => selectionFor(g).length < g.min_select);
  const canAdd = Boolean(selected) && unfilled.length === 0;

  const optionsDelta = data.option_groups.reduce(
    (sum, g) =>
      sum +
      selectionFor(g).reduce(
        (acc, id) => acc + (g.items.find((i) => i.variant_id === id)?.price_delta ?? 0),
        0,
      ),
    0,
  );
  const total = selected ? (selected.price + optionsDelta) * qty : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 pb-4">
        <Thumb src={data.image_url} rounded="" className="aspect-[4/3] w-full text-6xl" eager />

        <div className="app-rise px-4 pt-4">
          <h1 className="text-xl font-bold">{data.name}</h1>
          {data.description && <p className="mt-2 text-sm opacity-70">{data.description}</p>}
        </div>

        {data.variants.length > 0 && (
          <div className="app-rise mt-5 px-4">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-50">Розмір</p>
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
                    className="app-press rounded-xl px-3 py-2 text-left text-sm"
                    style={chipStyle(active)}
                  >
                    <span className="font-semibold">{v.label}</span>
                    {v.weight && <span className="ml-2 opacity-70">{v.weight}</span>}
                    <span className="ml-2 font-medium">{formatPrice(v.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {data.option_groups.map((group) => {
          const chosen = selectionFor(group);
          const fixed = isFixed(group);
          return (
            <div key={group.group_id} className="app-rise mt-5 px-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide opacity-50">
                  {group.name}
                </p>
                <p className="shrink-0 text-xs opacity-40">{selectionHint(group)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const active = chosen.includes(item.variant_id);
                  return (
                    <button
                      key={item.variant_id}
                      disabled={fixed}
                      onClick={() => toggleOption(group, item.variant_id)}
                      className={`rounded-xl px-3 py-2 text-sm disabled:opacity-100 ${fixed ? "" : "app-press"}`}
                      style={chipStyle(active)}
                    >
                      {active && (
                        <span className="app-pop mr-1.5 inline-block text-xs" aria-hidden>
                          ✓
                        </span>
                      )}
                      <span className={active ? "font-semibold" : undefined}>{item.name}</span>
                      {item.price_delta > 0 && (
                        <span className="ml-2 opacity-70">+{formatPrice(item.price_delta)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="app-rise mt-5 flex items-center gap-4 px-4">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-50">Кількість</p>
          <div className="flex items-center gap-3 rounded-xl px-2 py-1" style={{ background: "var(--app-surface)" }}>
            <button
              onClick={() => { haptic("light"); setQty((q) => Math.max(1, q - 1)); }}
              disabled={qty <= 1}
              className="app-press h-8 w-8 text-lg font-bold disabled:opacity-30"
              aria-label="Менше"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <button
              onClick={() => { haptic("light"); setQty((q) => q + 1); }}
              className="app-press h-8 w-8 text-lg font-bold"
              aria-label="Більше"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div
        className="sticky bottom-0 border-t p-4"
        style={{
          background: "var(--app-veil)",
          backdropFilter: "blur(12px)",
          borderColor: "var(--app-border)",
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
        }}
      >
        {addToCart.isError && (
          <p className="mb-2 text-center text-sm text-red-500">{addToCart.error.message}</p>
        )}
        {unfilled.length > 0 && (
          <p className="mb-2 text-center text-sm opacity-60">
            Оберіть: {unfilled.map((g) => g.name.toLowerCase()).join(", ")}
          </p>
        )}
        <button
          disabled={!canAdd || addToCart.isPending}
          onClick={() => {
            if (!selected) return;
            const options = data.option_groups.flatMap((g) =>
              selectionFor(g).map((variant_id) => ({ group_id: g.group_id, variant_id })),
            );
            addToCart.mutate(
              { variant_id: selected.id, qty, options },
              {
                onSuccess: () => {
                  hapticNotify("success");
                  void navigate("/cart");
                },
                onError: () => hapticNotify("error"),
              },
            );
          }}
          className="app-press w-full rounded-xl py-3 font-semibold disabled:opacity-50"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
            boxShadow: canAdd ? "var(--app-shadow)" : undefined,
          }}
        >
          {addToCart.isPending ? "Додаємо…" : `Додати в кошик — ${formatPrice(total)}`}
        </button>
      </div>
    </div>
  );
}
