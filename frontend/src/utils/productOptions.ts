import type React from "react";
import type { OptionGroup } from "@/api/types";

/** Скільки порцій обрано в групі: ключ — variant_id, значення — кількість. */
export type Picks = Record<number, number>;

/**
 * Група, де вибирати нема з чого: треба взяти рівно стільки, скільки є
 * (Хенд-рол СЕТ — усі три соуси). Показуємо як склад, а не як вибір.
 */
export function isFixed(group: OptionGroup): boolean {
  return group.min_select >= group.items.length && group.max_select <= group.items.length;
}

export function unitsIn(picks: Picks): number {
  return Object.values(picks).reduce((sum, n) => sum + n, 0);
}

/**
 * Ефективні межі групи з урахуванням кількості товару в позиції: скільки
 * одиниць товару беремо (qty), стільки разів множаться ліміти й безкоштовна
 * квота. Дзеркалить бекенд (api/src/routers/cart.py): effective_min/max/free = rule * qty.
 */
export function effectiveLimits(group: OptionGroup, qty: number): { min: number; max: number; free: number } {
  return {
    min: group.min_select * qty,
    max: group.max_select * qty,
    free: group.free_count * qty,
  };
}

/**
 * Вартість опцій групи з урахуванням безкоштовної квоти, помноженої на qty.
 */
export function groupCost(group: OptionGroup, picks: Picks, qty: number): number {
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
export function selectionHint(group: OptionGroup, qty: number): string {
  if (isFixed(group)) return "усе включено";

  const { min, max, free } = effectiveLimits(group, qty);

  const need =
    min === max
      ? `оберіть ${min}`
      : min === 0
        ? `до ${max}`
        : `${min}–${max}`;

  if (free === 0 || free >= max) return need;
  const freeLabel = free === 1 ? "перша безкоштовно" : `${free} безкоштовно`;
  return `${need} · ${freeLabel}`;
}

/** Спільний вигляд для «таблеток» розміру й опцій. */
export function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--tg-theme-button-color)" : "var(--app-surface)",
    color: active ? "var(--tg-theme-button-text-color)" : "inherit",
    boxShadow: active ? "var(--app-shadow-sm)" : undefined,
    border: active ? "1px solid transparent" : "1px solid var(--app-border)",
  };
}

