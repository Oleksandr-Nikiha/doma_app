import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAddToCart, useProduct } from "@/api/queries";
import { ErrorBox, Spinner, formatPrice } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function ProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  useBackButton();

  const { data, isPending, error, refetch } = useProduct(Number(productId));
  const addToCart = useAddToCart();

  // null = ще не обрано; після завантаження підставляємо перший варіант
  const [variantId, setVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  const selected = data.variants.find((v) => v.id === variantId) ?? data.variants[0];
  const total = selected ? selected.price * qty : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 pb-4">
        {data.image_url ? (
          <img src={data.image_url} alt="" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div
            className="flex aspect-[4/3] w-full items-center justify-center text-6xl opacity-30"
            style={{ background: "var(--tg-theme-secondary-bg-color)" }}
          >
            🍕
          </div>
        )}

        <div className="px-4 pt-4">
          <h1 className="text-xl font-bold">{data.name}</h1>
          {data.description && <p className="mt-2 text-sm opacity-70">{data.description}</p>}
        </div>

        {data.variants.length > 0 && (
          <div className="mt-5 px-4">
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
                    className="rounded-xl px-3 py-2 text-left text-sm"
                    style={{
                      background: active
                        ? "var(--tg-theme-button-color)"
                        : "var(--tg-theme-secondary-bg-color)",
                      color: active ? "var(--tg-theme-button-text-color)" : "inherit",
                    }}
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

        <div className="mt-5 flex items-center gap-4 px-4">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-50">Кількість</p>
          <div className="flex items-center gap-3 rounded-xl px-2 py-1" style={{ background: "var(--tg-theme-secondary-bg-color)" }}>
            <button
              onClick={() => { haptic("light"); setQty((q) => Math.max(1, q - 1)); }}
              disabled={qty <= 1}
              className="h-8 w-8 text-lg font-bold disabled:opacity-30"
              aria-label="Менше"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <button
              onClick={() => { haptic("light"); setQty((q) => q + 1); }}
              className="h-8 w-8 text-lg font-bold"
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
          background: "var(--tg-theme-bg-color)",
          borderColor: "var(--tg-theme-secondary-bg-color)",
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
        }}
      >
        {addToCart.isError && (
          <p className="mb-2 text-center text-sm text-red-500">{addToCart.error.message}</p>
        )}
        <button
          disabled={!selected || addToCart.isPending}
          onClick={() => {
            if (!selected) return;
            addToCart.mutate(
              { variant_id: selected.id, qty },
              {
                onSuccess: () => {
                  hapticNotify("success");
                  void navigate("/cart");
                },
                onError: () => hapticNotify("error"),
              },
            );
          }}
          className="w-full rounded-xl py-3 font-semibold disabled:opacity-50"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          {addToCart.isPending ? "Додаємо…" : `Додати в кошик — ${formatPrice(total)}`}
        </button>
      </div>
    </div>
  );
}
