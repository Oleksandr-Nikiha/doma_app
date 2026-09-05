import { useNavigate, useParams } from "react-router-dom";

import { useCategories, useProducts } from "@/api/queries";
import { EmptyState, ErrorBox, ScreenTitle, Spinner, formatPrice } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic } from "@/telegram/sdk";

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

  return (
    <div className="pb-4">
      <ScreenTitle>{title}</ScreenTitle>
      <div className="space-y-3 px-4">
        {data.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              haptic("light");
              void navigate(`/products/${p.id}`);
            }}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left active:opacity-70"
            style={{ background: "var(--tg-theme-secondary-bg-color)" }}
          >
            {p.image_url ? (
              <img src={p.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl opacity-40">
                🍕
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="mt-1 text-sm opacity-60">від {formatPrice(p.price_from)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
