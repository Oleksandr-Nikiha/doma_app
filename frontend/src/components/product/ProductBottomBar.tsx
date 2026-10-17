import { formatPrice } from "@/components/ui";
import { haptic } from "@/telegram/sdk";

interface ProductBottomBarProps {
  qty: number;
  setQty: React.Dispatch<React.SetStateAction<number>>;
  total: number;
  canAdd: boolean;
  showErrors: boolean;
  unfilledNames: string[];
  addedSuccess: boolean;
  isPending: boolean;
  isEdit: boolean;
  errorMessage?: string | null;
  onAdd: () => void;
  onGoToCart: () => void;
}

export function ProductBottomBar({
  qty,
  setQty,
  total,
  canAdd,
  showErrors,
  unfilledNames,
  addedSuccess,
  isPending,
  isEdit,
  errorMessage,
  onAdd,
  onGoToCart,
}: ProductBottomBarProps) {
  return (
    <div
      className="sticky bottom-0 z-30 app-glass border-t p-4"
      style={{
        borderColor: "var(--app-border)",
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
        boxShadow: "0 -4px 16px -4px rgb(0 0 0 / 8%)",
      }}
    >
      {errorMessage && (
        <p className="mb-2 text-center text-xs font-semibold text-rose-500">
          {errorMessage}
        </p>
      )}

      {unfilledNames.length > 0 && showErrors && (
        <p className="mb-2.5 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
          Будь ласка, оберіть: {unfilledNames.join(", ")}
        </p>
      )}

      {addedSuccess && (
        <div className="mb-2.5 flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 app-rise">
          <span className="flex items-center gap-1.5">
            <span>✓</span>
            <span>Додано в кошик!</span>
          </span>
          <button
            type="button"
            onClick={onGoToCart}
            className="underline hover:opacity-80 font-bold"
          >
            Перейти до кошика →
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Лічильник кількості порцій */}
        <div
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 shrink-0"
          style={{ background: "var(--app-surface-2)", border: "1px solid var(--app-border)" }}
        >
          <button
            onClick={() => {
              haptic("light");
              setQty((q) => Math.max(1, q - 1));
            }}
            disabled={qty <= 1}
            className="app-press h-8 w-8 text-lg font-bold disabled:opacity-25 flex items-center justify-center rounded-lg"
            aria-label="Менше"
          >
            −
          </button>
          <span className="w-5 text-center text-sm font-bold">{qty}</span>
          <button
            onClick={() => {
              haptic("light");
              setQty((q) => q + 1);
            }}
            className="app-press h-8 w-8 text-lg font-bold flex items-center justify-center rounded-lg"
            aria-label="Більше"
          >
            +
          </button>
        </div>

        {/* Головна кнопка додавання */}
        <button
          disabled={isPending}
          onClick={onAdd}
          className="app-press flex-1 rounded-xl py-3.5 px-4 font-bold text-sm shadow-md transition-all flex items-center justify-between"
          style={
            canAdd
              ? {
                  background: addedSuccess ? "#16a34a" : "var(--tg-theme-button-color)",
                  color: "var(--tg-theme-button-text-color)",
                  boxShadow: "var(--app-shadow)",
                }
              : {
                  background: "var(--app-surface-2)",
                  color: "inherit",
                  opacity: 0.8,
                }
          }
        >
          <span>
            {isPending
              ? "Зберігаємо…"
              : addedSuccess
                ? "✓ Додано в кошик"
                : isEdit
                  ? "Зберегти зміни"
                  : "В кошик"}
          </span>
          <span className="font-extrabold">{formatPrice(total)}</span>
        </button>
      </div>
    </div>
  );
}
