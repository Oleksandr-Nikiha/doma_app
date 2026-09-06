import { useNavigate } from "react-router-dom";

import { useCategories } from "@/api/queries";
import { ErrorBox, ScreenTitle, SectionHeading, Spinner } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import type { Category } from "@/api/types";

interface Root {
  category: Category;
  children: Category[];
}

/**
 * Складає дерево й розкладає корені по закладах.
 *
 * Категорії приходять пласким списком у правильному порядку (корінь, далі його
 * діти) — тут лише перегруповуємо, не сортуємо.
 */
function groupByLocation(categories: Category[]) {
  const childrenOf = new Map<number, Category[]>();
  for (const c of categories) {
    if (c.parent_id === null) continue;
    const list = childrenOf.get(c.parent_id) ?? [];
    list.push(c);
    childrenOf.set(c.parent_id, list);
  }

  const map = new Map<number, { name: string; roots: Root[] }>();
  for (const c of categories) {
    if (c.parent_id !== null) continue;
    const group = map.get(c.location_id) ?? { name: c.location_name, roots: [] };
    group.roots.push({ category: c, children: childrenOf.get(c.id) ?? [] });
    map.set(c.location_id, group);
  }
  return [...map.values()];
}

export function CategoriesPage() {
  const navigate = useNavigate();
  const { data, isPending, error, refetch } = useCategories();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="pb-4">
      <ScreenTitle>Меню</ScreenTitle>
      {groupByLocation(data).map((group) => (
        <section key={group.name} className="mb-5">
          <SectionHeading>{group.name}</SectionHeading>
          {/* Поява — на контейнері, а не на кожній картці: у картки свій
              перехід на натиск, і два transition на одному елементі б'ються. */}
          <div className="app-rise space-y-3 px-4">
            {group.roots.map(({ category, children }) => (
              <div key={category.id} className="app-card overflow-hidden rounded-2xl">
                <button
                  onClick={() => {
                    haptic("light");
                    void navigate(`/categories/${category.id}`);
                  }}
                  className="app-press flex w-full items-center gap-3 p-4 text-left"
                >
                  <span className="text-3xl leading-none">{category.icon ?? "🍕"}</span>
                  <span className="flex-1 font-medium">{category.name}</span>
                  <span className="text-lg opacity-25" aria-hidden>
                    ›
                  </span>
                </button>

                {/* Ярлики підкатегорій ведуть у той самий список товарів, але
                    одразу до потрібної секції — інакше до «Роли Макі» треба
                    прогорнути півсотні позицій. */}
                {children.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-4 pb-4">
                    {children.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          haptic("light");
                          void navigate(`/categories/${category.id}?section=${sub.id}`);
                        }}
                        className="app-press rounded-lg px-3 py-1.5 text-xs"
                        style={{ background: "var(--app-surface-2)" }}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
