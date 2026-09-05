import { useNavigate } from "react-router-dom";

import { useCategories } from "@/api/queries";
import { ErrorBox, ScreenTitle, Spinner } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import type { Category } from "@/api/types";

/** Категорії приходять пласким списком — групуємо по закладу для заголовків. */
function groupByLocation(categories: Category[]) {
  const map = new Map<number, { name: string; items: Category[] }>();
  for (const c of categories) {
    const group = map.get(c.location_id) ?? { name: c.location_name, items: [] };
    group.items.push(c);
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
          <h2 className="px-4 pb-2 text-sm font-semibold uppercase tracking-wide opacity-50">
            {group.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 px-4">
            {group.items.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  haptic("light");
                  void navigate(`/categories/${cat.id}`, { state: { title: cat.name } });
                }}
                className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left active:opacity-70"
                style={{ background: "var(--tg-theme-secondary-bg-color)" }}
              >
                <span className="text-3xl leading-none">{cat.icon ?? "🍕"}</span>
                <span className="text-sm font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
