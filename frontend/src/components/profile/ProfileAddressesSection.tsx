import { AddressSelector } from "@/components/delivery/AddressSelector";
import { haptic } from "@/telegram/sdk";

interface ProfileAddressesSectionProps {
  deliveryAddress: string;
  setDeliveryAddress: (addr: string) => void;
  additionalAddress: string;
  setAdditionalAddress: (addr: string) => void;
  isEditingMainAddress: boolean;
  setIsEditingMainAddress: (editing: boolean) => void;
  isEditingAdditionalAddress: boolean;
  setIsEditingAdditionalAddress: (editing: boolean) => void;
  onAddressChange: () => void;
}

export function ProfileAddressesSection({
  deliveryAddress,
  setDeliveryAddress,
  additionalAddress,
  setAdditionalAddress,
  isEditingMainAddress,
  setIsEditingMainAddress,
  isEditingAdditionalAddress,
  setIsEditingAdditionalAddress,
  onAddressChange,
}: ProfileAddressesSectionProps) {
  return (
    <section className="app-rise space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Мої адреси доставки</p>

      <div className="space-y-3">
        {/* 1. Основна адреса */}
        {isEditingMainAddress ? (
          <div
            className="app-card rounded-2xl border border-[var(--app-border)] p-4 space-y-3.5 shadow-sm"
            style={{ background: "var(--app-surface)" }}
          >
            <div className="flex items-center justify-between border-b pb-2 border-[var(--app-border)]">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📍</span>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Основна адреса доставки
                </span>
              </div>
              {deliveryAddress && (
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setIsEditingMainAddress(false);
                  }}
                  className="text-xs font-semibold text-[var(--tg-theme-button-color)] hover:opacity-80"
                >
                  Згорнути ✕
                </button>
              )}
            </div>
            <AddressSelector
              value={deliveryAddress}
              required={false}
              onChange={(full) => {
                setDeliveryAddress(full);
                onAddressChange();
              }}
            />
          </div>
        ) : (
          <div
            className="app-card flex items-center justify-between rounded-2xl p-3.5 border transition-all"
            style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-lg text-blue-600">
                📍
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
                    Основна адреса
                  </span>
                  {deliveryAddress ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.2 text-[10px] font-bold text-emerald-600">
                      Збережено
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.2 text-[10px] font-semibold text-amber-600">
                      Не вказано
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm font-medium truncate" title={deliveryAddress || "Вкажіть адресу для швидкого замовлення"}>
                  {deliveryAddress || "Вкажіть адресу для швидкого замовлення"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setIsEditingMainAddress(true);
              }}
              className="app-press shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--tg-theme-button-color)] hover:opacity-100"
            >
              {deliveryAddress ? "Змінити" : "+ Додати"}
            </button>
          </div>
        )}

        {/* 2. Додаткова адреса */}
        {isEditingAdditionalAddress ? (
          <div
            className="app-card rounded-2xl border border-[var(--app-border)] p-4 space-y-3.5 shadow-sm"
            style={{ background: "var(--app-surface)" }}
          >
            <div className="flex items-center justify-between border-b pb-2 border-[var(--app-border)]">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🏢</span>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Додаткова адреса (робота, рідні)
                </span>
              </div>
              {additionalAddress && (
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setIsEditingAdditionalAddress(false);
                  }}
                  className="text-xs font-semibold text-[var(--tg-theme-button-color)] hover:opacity-80"
                >
                  Згорнути ✕
                </button>
              )}
            </div>
            <AddressSelector
              value={additionalAddress}
              required={false}
              onChange={(full) => {
                setAdditionalAddress(full);
                onAddressChange();
              }}
            />
          </div>
        ) : (
          <div
            className="app-card flex items-center justify-between rounded-2xl p-3.5 border transition-all"
            style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-lg text-purple-600">
                🏢
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
                    Додаткова адреса
                  </span>
                  {additionalAddress ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.2 text-[10px] font-bold text-emerald-600">
                      Збережено
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-500/15 px-2 py-0.2 text-[10px] font-semibold opacity-60">
                      Не вказано
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm font-medium truncate" title={additionalAddress || "Офіс, робота або адреса рідних"}>
                  {additionalAddress || "Офіс, робота або адреса рідних"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setIsEditingAdditionalAddress(true);
              }}
              className="app-press shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--tg-theme-button-color)] hover:opacity-100"
            >
              {additionalAddress ? "Змінити" : "+ Додати"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
