import { useNavigate, useParams } from "react-router-dom";

import { useCategories, useProducts } from "@/api/queries";
import {
  EmptyState,
  ErrorBox,
  ScreenTitle,
  SectionHeading,
  Spinner,
  Thumb,
  formatPrice,
} from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic } from "@/telegram/sdk";
import type { Category, ProductListItem } from "@/api/types";

/**
 * Розкладає товари по підкатегоріях.
 *
 * Бекенд сортує лише за p.sort_order, а той нумерується всередині кожної
 * підкатегорії — тож у відповіді товари різних секцій перемішані, і порядок
 * появи секцій довільний. Тому беремо порядок із дерева категорій: воно
 * приходить у правильній послідовності (корінь, далі його діти за sort_order).
 */
function groupBySubcategory(products: ProductListItem[], categories: Category[] | undefined) {
  const order = new Map<number, number>();
  categories?.forEach((c, i) => order.set(c.id, i));

  const map = new Map<number, { name: string; items: ProductListItem[] }>();
  for (const p of products) {
    const group = map.get(p.category_id) ?? { name: p.category_name, items: [] };
    group.items.push(p);
    map.set(p.category_id, group);
  }

  return [...map.entries()]
    .sort(([a], [b]) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
    .map(([, group]) => group);
}

export function ProductsPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  useBackButton();

  const id = Number(categoryId);
  const { data, isPending, error, refetch } = useProducts(id);

  // Назву беремо з кешу категорій — інакше при прямому переході за URL
  // (перезавантаження, посилання) заголовок був би порожній
  const { data: categories } = useCategories();
  const title = categories?.find((c) => c.id === id)?.name ?? "Товари";

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
  if (data.length === 0) {
    return <EmptyState icon="🕐" title="Тут поки порожньо" hint="Скоро додамо позиції в цю категорію" />;
  }

  const groups = groupBySubcategory(data, categories);
  // Якщо відкрито саму підкатегорію — секція одна, і її заголовок дублював би
  // назву екрана. Показуємо просто список.
  const withHeadings = groups.length > 1;

  return (
    <div className="pb-4">
      <ScreenTitle>{title}</ScreenTitle>
      {groups.map((group) => (
        <section key={group.name} className="mb-5 last:mb-0">
          {withHeadings && <SectionHeading>{group.name}</SectionHeading>}
          {/* Поява — на контейнері: у картки свій перехід на натиск */}
          <div className="app-rise space-y-3 px-4">
            {group.items.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  haptic("light");
                  void navigate(`/products/${p.id}`);
                }}
                className="app-card app-press flex w-full items-center gap-3 rounded-2xl p-3 text-left"
              >
                <Thumb src={p.image_url} className="h-16 w-16 shrink-0 text-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="mt-1 text-sm opacity-60">від {formatPrice(p.price_from)}</p>
                </div>
                <span className="shrink-0 pr-1 text-lg opacity-25" aria-hidden>
                  ›
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
