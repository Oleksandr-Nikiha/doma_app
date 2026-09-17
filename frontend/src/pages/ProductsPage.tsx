import { useLayoutEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useCategories, useProducts } from "@/api/queries";
import {
  EmptyState,
  ErrorBox,
  ProductListSkeleton,
  ScreenTitle,
  SectionHeading,
  Thumb,
  formatPrice,
} from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic } from "@/telegram/sdk";
import type { Category, ProductListItem } from "@/api/types";

/** Якір секції в DOM — за ним працює перехід із головної до підкатегорії. */
const sectionDomId = (categoryId: number) => `cat-${categoryId}`;

/**
 * Розкладає товари по підкатегоріях.
 */
function groupBySubcategory(products: ProductListItem[], categories: Category[] | undefined) {
  const order = new Map<number, number>();
  categories?.forEach((c, i) => order.set(c.id, i));

  const map = new Map<number, { id: number; name: string; items: ProductListItem[] }>();
  for (const p of products) {
    const group = map.get(p.category_id) ?? { id: p.category_id, name: p.category_name, items: [] };
    group.items.push(p);
    map.set(p.category_id, group);
  }

  return [...map.values()].sort(
    (a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity),
  );
}

export function ProductsPage() {
  const { categoryId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  useBackButton();

  const id = Number(categoryId);
  const { data, isPending, error, refetch } = useProducts(id);

  const { data: categories } = useCategories();
  const title = categories?.find((c) => c.id === id)?.name ?? "Товари";

  const targetSection = searchParams.get("section");
  useLayoutEffect(() => {
    if (!targetSection || !data) return;
    document.getElementById(sectionDomId(Number(targetSection)))?.scrollIntoView({ block: "start" });
  }, [targetSection, data]);

  if (isPending) return <ProductListSkeleton />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
  if (data.length === 0) {
    return <EmptyState icon="🕐" title="Тут поки порожньо" hint="Скоро додамо позиції в цю категорію" />;
  }

  const groups = groupBySubcategory(data, categories);
  const withHeadings = groups.length > 1;

  const scrollToSubcategory = (subId: number) => {
    haptic("light");
    const el = document.getElementById(sectionDomId(subId));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="pb-6">
      <ScreenTitle>{title}</ScreenTitle>

      {/* Липка горизонтальна стрічка швидкої навігації по підкатегоріях */}
      {withHeadings && (
        <div
          className="sticky top-0 z-20 app-glass border-b px-4 py-2 flex gap-1.5 overflow-x-auto no-scrollbar"
          style={{ borderColor: "var(--app-border)" }}
        >
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => scrollToSubcategory(group.id)}
              className="app-press shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: "var(--app-surface-2)",
                color: "var(--tg-theme-text-color)",
              }}
            >
              {group.name}{" "}
              <span className="opacity-50 text-[11px] font-normal">({group.items.length})</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        {groups.map((group) => (
          <section key={group.id} id={sectionDomId(group.id)} className="mb-6 last:mb-0">
            {withHeadings && (
              <SectionHeading sticky={!withHeadings}>
                <span>{group.name}</span>
                <span className="text-xs font-normal opacity-50 ml-1">
                  · {group.items.length} {group.items.length === 1 ? "страва" : "страв"}
                </span>
              </SectionHeading>
            )}

            <div className="app-rise space-y-2.5 px-4">
              {group.items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    haptic("light");
                    void navigate(`/products/${p.id}`);
                  }}
                  className="app-card app-press flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition-all"
                >
                  <Thumb
                    src={p.image_url}
                    rounded="rounded-xl"
                    className="h-16 w-16 shrink-0 text-2xl shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[15px] leading-snug">{p.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className="rounded-lg px-2 py-0.5 text-xs font-bold"
                        style={{
                          background: "var(--app-tint)",
                          color: "var(--tg-theme-button-color)",
                        }}
                      >
                        від {formatPrice(p.price_from)}
                      </span>
                    </div>
                  </div>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold opacity-80"
                    style={{ background: "var(--app-surface-2)" }}
                    aria-label="Обрати страву"
                  >
                    +
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
