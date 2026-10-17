import { SegmentedControl } from "@/components/ui";
import { AddressSelector } from "@/components/delivery/AddressSelector";
import { haptic } from "@/telegram/sdk";

export type AddressSource = "main" | "additional" | "custom";

interface DeliveryAddressSectionProps {
  fulfillmentType: "delivery" | "pickup";
  targetLocationAddress?: string | null;
  addressSource: AddressSource;
  onAddressSourceChange: (source: AddressSource) => void;
  userDeliveryAddress?: string | null;
  userAdditionalAddress?: string | null;
  onCustomAddressChange: (full: string, valid: boolean) => void;
  courierNote: string;
  onCourierNoteChange: (val: string) => void;
  onNavigateProfile: () => void;
}

export function DeliveryAddressSection({
  fulfillmentType,
  targetLocationAddress,
  addressSource,
  onAddressSourceChange,
  userDeliveryAddress,
  userAdditionalAddress,
  onCustomAddressChange,
  courierNote,
  onCourierNoteChange,
  onNavigateProfile,
}: DeliveryAddressSectionProps) {
  if (fulfillmentType === "pickup") {
    return (
      <div className="rounded-xl p-3.5 text-xs leading-relaxed" style={{ background: "var(--app-surface-2)" }}>
        <p className="font-semibold">Адреса для самовивозу:</p>
        <p className="mt-1 opacity-80">{targetLocationAddress || "м. Київ"}</p>

        <p className="mt-2 opacity-60">
          Ми повідомимо вас у чаті з ботом, щойно замовлення буде готове до видачі.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
          Адреса доставки
        </label>
        <SegmentedControl
          value={addressSource}
          onChange={(val) => {
            haptic("light");
            onAddressSourceChange(val as AddressSource);
          }}
          options={[
            { value: "main", label: "Основна", icon: "📍" },
            { value: "additional", label: "Додаткова", icon: "🏢" },
            { value: "custom", label: "Інша", icon: "✏️" },
          ]}
        />
      </div>

      {/* Вміст обраного типу адреси */}
      {addressSource === "main" && (
        <div
          className="rounded-2xl border border-[var(--app-border)] p-3.5 transition"
          style={{ background: "var(--app-surface-2)" }}
        >
          {userDeliveryAddress ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium opacity-60">📍 Основна адреса</span>
                <button
                  type="button"
                  onClick={onNavigateProfile}
                  className="text-xs font-semibold text-[var(--tg-theme-button-color)] hover:underline"
                >
                  Змінити в профілі
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold">{userDeliveryAddress}</p>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs opacity-70">Основна адреса не вказана у вашому профілі</p>
              <div className="mt-2.5 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onNavigateProfile}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium bg-[var(--app-surface)] border border-[var(--app-border)]"
                >
                  Вказати в профілі
                </button>
                <button
                  type="button"
                  onClick={() => onAddressSourceChange("custom")}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
                >
                  Вказати іншу адресу
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {addressSource === "additional" && (
        <div
          className="rounded-2xl border border-[var(--app-border)] p-3.5 transition"
          style={{ background: "var(--app-surface-2)" }}
        >
          {userAdditionalAddress ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium opacity-60">🏢 Додаткова адреса</span>
                <button
                  type="button"
                  onClick={onNavigateProfile}
                  className="text-xs font-semibold text-[var(--tg-theme-button-color)] hover:underline"
                >
                  Змінити в профілі
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold">{userAdditionalAddress}</p>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs opacity-70">Додаткова адреса не вказана у вашому профілі</p>
              <div className="mt-2.5 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onNavigateProfile}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium bg-[var(--app-surface)] border border-[var(--app-border)]"
                >
                  Вказати в профілі
                </button>
                <button
                  type="button"
                  onClick={() => onAddressSourceChange("custom")}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
                >
                  Вказати іншу адресу
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {addressSource === "custom" && (
        <AddressSelector onChange={onCustomAddressChange} />
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
          Під'їзд, код домофону або примітка кур'єру (необов'язково)
        </label>
        <input
          type="text"
          value={courierNote}
          onChange={(e) => onCourierNoteChange(e.target.value)}
          placeholder="під'їзд 2, поверх 4, код 1234, заїзд з боку двору"
          className="w-full rounded-xl border border-[var(--app-border)] p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--app-surface-2)" }}
        />
      </div>
    </div>
  );
}

