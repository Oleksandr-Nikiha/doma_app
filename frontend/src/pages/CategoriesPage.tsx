import { useNavigate } from "react-router-dom";

import { useCategories } from "@/api/queries";
import { CategorySkeleton, ErrorBox, ScreenTitle, SectionHeading } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import type { Category } from "@/api/types";

interface Root {
  category: Category;
  children: Category[];
}

/**
 * Складає дерево й розкладає корені по закладах.
 * Категорії приходять пласким списком у правильному порядку (корінь, далі його діти).
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

  if (isPending) return <CategorySkeleton />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="pb-6">
      <ScreenTitle>Меню</ScreenTitle>
      {groupByLocation(data).map((group) => {
        const isCroissant = group.name.toLowerCase().includes("croissant");
        return (
          <section key={group.name} className="mb-6 last:mb-0">
            <SectionHeading>
              <span className="flex items-center gap-1.5">
                <span>{isCroissant ? "🥐" : "🍕"}</span>
                <span>{group.name}</span>
              </span>
            </SectionHeading>

            <div className="app-rise space-y-3 px-4">
              {group.roots.map(({ category, children }) => (
                <div
                  key={category.id}
                  className="app-card overflow-hidden rounded-2xl transition-all"
                >
                  <button
                    onClick={() => {
                      haptic("light");
                      void navigate(`/categories/${category.id}`);
                    }}
                    className="app-press flex w-full items-center gap-3.5 p-3.5 text-left"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
                      style={{ background: "var(--app-surface-2)" }}
                    >
                      {category.icon ?? (isCroissant ? "🥐" : "🍕")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-base leading-tight truncate">
                        {category.name}
                      </p>
                      {children.length > 0 && (
                        <p className="mt-1 text-xs opacity-50">
                          {children.length} {children.length === 1 ? "розділ" : children.length < 5 ? "розділи" : "розділів"}
                        </p>
                      )}
                    </div>
                    <span className="text-xl opacity-35 px-1 font-light" aria-hidden>
                      ›
                    </span>
                  </button>

                  {/* Ярлики підкатегорій для швидкого переходу */}
                  {children.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5 pt-0.5">
                      {children.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            haptic("light");
                            void navigate(`/categories/${category.id}?section=${sub.id}`);
                          }}
                          className="app-press rounded-xl px-2.5 py-1 text-xs font-medium transition-all"
                          style={{
                            background: "var(--app-surface-2)",
                            color: "var(--tg-theme-text-color)",
                          }}
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
        );
      })}
    </div>
  );
}
