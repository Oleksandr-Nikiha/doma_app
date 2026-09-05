import { useNavigate } from "react-router-dom";

import { useCategories } from "@/api/queries";
import { ErrorBox, ScreenTitle, SectionHeading, Spinner } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import type { Category } from "@/api/types";

/**
 * На головній показуємо лише кореневі категорії. Підкатегорії («Фірмові»,
 * «Роли Макі») окремими плитками не потрібні: тап по кореню відкриває всі
 * його товари, розкладені по секціях — на один рівень навігації менше.
 */
function groupByLocation(categories: Category[]) {
  const map = new Map<number, { name: string; items: Category[] }>();
  for (const c of categories) {
    if (c.parent_id !== null) continue;
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
          <SectionHeading>{group.name}</SectionHeading>
          {/* Поява — на контейнері, а не на кожній плитці: плитка має власний
              перехід на натиск, і два transition на одному елементі б'ються. */}
          <div className="app-rise grid grid-cols-2 gap-3 px-4">
            {group.items.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  haptic("light");
                  void navigate(`/categories/${cat.id}`, { state: { title: cat.name } });
                }}
                className="app-card app-press flex flex-col items-start gap-2 rounded-2xl p-4 text-left"
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
