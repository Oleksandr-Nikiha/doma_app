import { useState, useMemo } from "react";
import {
  useAdminLocationsDelivery,
  useUpdateLocationDelivery,
  useAdminDeliveryAddresses,
  useCreateAdminDeliveryAddress,
  useUpdateAdminDeliveryAddress,
  useDeleteAdminDeliveryAddress,
} from "@/api/queries";
import type {
  AdminDeliveryAddress,
  LocationDeliverySettings,
} from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

// ============================================================================
// 5. ВКЛАДКА НАЛАШТУВАННЯ ДОСТАВКИ ТА НАВАНТАЖЕННЯ
// ============================================================================

interface DeliverySettingsTabProps {
  locationId?: number | null;
  isSuperAdmin: boolean;
}

export function DeliverySettingsTab({ locationId }: DeliverySettingsTabProps) {
  const [subTab, setSubTab] = useState<"locations" | "addresses">("locations");
  const { data: deliverySettings = [], isPending, error, refetch } = useAdminLocationsDelivery();
  const updateDelivery = useUpdateLocationDelivery();

  const filtered = useMemo(() => {
    if (!locationId) return deliverySettings;
    return deliverySettings.filter((loc: LocationDeliverySettings) => loc.id === locationId);
  }, [deliverySettings, locationId]);

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      {/* Підвкладки: Заклади / Адреси */}
      <div
        className="flex rounded-xl p-1 text-xs font-semibold"
        style={{ background: "var(--app-surface-2)" }}
      >
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setSubTab("locations");
          }}
          className={`app-press flex-1 rounded-lg py-2 transition-all ${
            subTab === "locations"
              ? "bg-[var(--app-surface)] shadow-sm font-bold text-[var(--tg-theme-text-color)]"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          🛵 Заклади та години
        </button>
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setSubTab("addresses");
          }}
          className={`app-press flex-1 rounded-lg py-2 transition-all ${
            subTab === "addresses"
              ? "bg-[var(--app-surface)] shadow-sm font-bold text-[var(--tg-theme-text-color)]"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          📍 Довідник адрес (Стоплист)
        </button>
      </div>

      {subTab === "locations" ? (
        <div className="space-y-4">
          <div
            className="rounded-2xl p-4 text-xs leading-relaxed border"
            style={{
              background: "var(--app-tint)",
              color: "var(--tg-theme-link-color)",
              borderColor: "color-mix(in srgb, var(--tg-theme-link-color) 30%, transparent)",
            }}
          >
            <p className="font-semibold text-[13px] flex items-center gap-1.5">
              <span>🛵</span>
              <span>Керування доставкою та навантаженням</span>
            </p>
            <p className="mt-1 opacity-90">
              У разі перевантаження кухні або браку кур'єрів ви можете <b>вимкнути доставку</b> для закладу в один клік. Клієнти зможуть оформлювати замовлення виключно на самовивіз. Також тут налаштовуються години роботи доставки.
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="🛵" title="Закладів не знайдено" hint="Не вдалося знайти налаштування для обраного закладу" />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filtered.map((loc: LocationDeliverySettings) => (
                <LocationDeliveryCard
                  key={loc.id}
                  location={loc}
                  onUpdate={(payload) => {
                    updateDelivery.mutate(
                      { locationId: loc.id, payload },
                      {
                        onSuccess: () => hapticNotify("success"),
                        onError: () => hapticNotify("error"),
                      },
                    );
                  }}
                  isUpdating={updateDelivery.isPending}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <DeliveryAddressesAdminSection />
      )}
    </div>
  );
}

function LocationDeliveryCard({
  location,
  onUpdate,
  isUpdating,
}: {
  location: LocationDeliverySettings;
  onUpdate: (payload: { is_delivery_enabled?: boolean; delivery_start_time?: string; delivery_end_time?: string }) => void;
  isUpdating: boolean;
}) {
  const [startTime, setStartTime] = useState(location.delivery_start_time || "10:00");
  const [endTime, setEndTime] = useState(location.delivery_end_time || "22:00");
  const [hasHoursChanged, setHasHoursChanged] = useState(false);

  const handleToggleDelivery = () => {
    haptic("medium");
    onUpdate({ is_delivery_enabled: !location.is_delivery_enabled });
  };

  const handleSaveHours = (e: React.FormEvent) => {
    e.preventDefault();
    haptic("light");
    onUpdate({ delivery_start_time: startTime, delivery_end_time: endTime });
    setHasHoursChanged(false);
  };

  return (
    <div className="app-card rounded-2xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--app-border)" }}>
        <div>
          <h3 className="font-bold text-base flex items-center gap-1.5">
            <span>📍</span>
            <span>{location.name}</span>
          </h3>
          <p className="mt-0.5 text-xs opacity-60">{location.address}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            location.is_delivery_enabled ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
          }`}
        >
          {location.is_delivery_enabled ? "🟢 Доставка активна" : "🔴 Доставка вимкнена"}
        </span>
      </div>

      {/* Аварійний перемикач навантаження */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">
          Аварійне вимкнення при навантаженні
        </label>
        <button
          type="button"
          onClick={handleToggleDelivery}
          disabled={isUpdating}
          className="app-press w-full rounded-xl py-3 px-4 text-xs font-bold transition flex items-center justify-between shadow-sm"
          style={{
            background: location.is_delivery_enabled
              ? "color-mix(in srgb, #ef4444 12%, transparent)"
              : "color-mix(in srgb, #22c55e 12%, transparent)",
            color: location.is_delivery_enabled ? "#ef4444" : "#22c55e",
            border: `1px solid ${location.is_delivery_enabled ? "color-mix(in srgb, #ef4444 30%, transparent)" : "color-mix(in srgb, #22c55e 30%, transparent)"}`,
          }}
        >
          <span>
            {location.is_delivery_enabled
              ? "⛔ Вимкнути доставку (високе навантаження)"
              : "✅ Увімкнути прийом доставки"}
          </span>
          <span className="text-xs">
            {location.is_delivery_enabled ? "Перевести на самовивіз →" : "Відновити →"}
          </span>
        </button>
        <p className="text-[11px] opacity-60 leading-relaxed">
          {location.is_delivery_enabled
            ? "Клієнти можуть обирати і доставку, і самовивіз."
            : "Доставка вимкнена: у клієнтів блокується кнопка доставки, замовлення приймаються виключно на самовивіз."}
        </p>
      </div>

      {/* Години роботи доставки */}
      <form onSubmit={handleSaveHours} className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--app-border)" }}>
        <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">
          Години прийому доставки
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
            <span className="block text-[11px] font-medium opacity-70 mb-1.5 flex items-center gap-1.5">
              <span>⏰</span>
              <span>Початок роботи</span>
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setHasHoursChanged(true);
              }}
              required
              className="w-full rounded-lg bg-transparent text-base font-bold outline-none transition focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
            <span className="block text-[11px] font-medium opacity-70 mb-1.5 flex items-center gap-1.5">
              <span>🌙</span>
              <span>Кінець роботи</span>
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setHasHoursChanged(true);
              }}
              required
              className="w-full rounded-lg bg-transparent text-base font-bold outline-none transition focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>
        </div>

        {hasHoursChanged && (
          <button
            type="submit"
            disabled={isUpdating}
            className="app-press w-full sm:w-auto px-6 rounded-xl py-2.5 text-xs font-bold shadow transition"
            style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
          >
            {isUpdating ? "Збереження..." : "Зберегти нові години"}
          </button>
        )}
      </form>
    </div>
  );
}

// ============================================================================
// 5.1. РОЗДІЛ КЕРУВАННЯ АДРЕСАМИ ДОСТАВКИ (СТОПЛИСТ)
// ============================================================================

function DeliveryAddressesAdminSection() {
  const { data: addresses = [], isPending, error, refetch } = useAdminDeliveryAddresses();
  const createAddress = useCreateAdminDeliveryAddress();
  const updateAddress = useUpdateAdminDeliveryAddress();
  const deleteAddress = useDeleteAdminDeliveryAddress();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "stoplist">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AdminDeliveryAddress | null>(null);

  const totalCount = addresses.length;
  const activeCount = addresses.filter((a) => a.is_active).length;
  const stoplistCount = totalCount - activeCount;

  const filteredAddresses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return addresses.filter((a) => {
      const matchSearch =
        !q ||
        a.street.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        (a.notes && a.notes.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (statusFilter === "active") return a.is_active;
      if (statusFilter === "stoplist") return !a.is_active;
      return true;
    });
  }, [addresses, search, statusFilter]);

  const handleToggleActive = (addr: AdminDeliveryAddress) => {
    haptic("medium");
    updateAddress.mutate(
      {
        addressId: addr.id,
        payload: { is_active: !addr.is_active },
      },
      {
        onSuccess: () => hapticNotify("success"),
        onError: () => hapticNotify("error"),
      },
    );
  };

  const handleDelete = (addr: AdminDeliveryAddress) => {
    if (!window.confirm(`Видалити адресу "${addr.street}" з довідника?`)) {
      return;
    }
    hapticNotify("warning");
    deleteAddress.mutate(addr.id, {
      onSuccess: () => hapticNotify("success"),
      onError: () => hapticNotify("error"),
    });
  };

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      {/* Інформаційна плашка */}
      <div
        className="rounded-2xl p-4 text-xs leading-relaxed border"
        style={{
          background: "var(--app-tint)",
          color: "var(--tg-theme-link-color)",
          borderColor: "color-mix(in srgb, var(--tg-theme-link-color) 30%, transparent)",
        }}
      >
        <p className="font-semibold text-[13px] flex items-center gap-1.5">
          <span>📍</span>
          <span>Керування довідником адрес та стоплистом</span>
        </p>
        <p className="mt-1 opacity-90">
          Клієнти обирають вулиці виключно з цього довідника. Якщо на певну вулицю тимчасово перекрито рух чи неможлива доставка — вимкніть її (переведіть у <b>стоплист</b>), і клієнти не зможуть обрати її для замовлення.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-black/10">
          <span className="rounded-full bg-white/40 px-2.5 py-0.5 text-[11px] font-semibold">
            Всього адрес: <b>{totalCount}</b>
          </span>
          <span className="rounded-full bg-emerald-500/20 text-emerald-700 px-2.5 py-0.5 text-[11px] font-semibold">
            🟢 Доставляємо: <b>{activeCount}</b>
          </span>
          <span className="rounded-full bg-rose-500/20 text-rose-700 px-2.5 py-0.5 text-[11px] font-semibold">
            🔴 Стоплист: <b>{stoplistCount}</b>
          </span>
        </div>
      </div>

      {/* Панель керування: пошук, фільтри, кнопка додавання */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук вулиці..."
            className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-2.5 pr-8 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            style={{ color: "var(--tg-theme-text-color)" }}
          />
          {search ? (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          ) : (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-40">
              🔍
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Фільтр статусу */}
          <div
            className="flex rounded-xl p-0.5 text-xs font-semibold"
            style={{ background: "var(--app-surface-2)" }}
          >
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                statusFilter === "all"
                  ? "bg-[var(--app-surface)] shadow-sm font-bold text-[var(--tg-theme-text-color)]"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              Всі ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                statusFilter === "active"
                  ? "bg-[var(--app-surface)] shadow-sm font-bold text-emerald-600"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              🟢 Активні ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter("stoplist")}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                statusFilter === "stoplist"
                  ? "bg-[var(--app-surface)] shadow-sm font-bold text-rose-600"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              🔴 Стоп ({stoplistCount})
            </button>
          </div>

          <button
            onClick={() => {
              haptic("light");
              setEditingAddress(null);
              setIsModalOpen(true);
            }}
            className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
            style={{ background: "var(--tg-theme-button-color)" }}
          >
            <span>+</span>
            <span>Додати адресу</span>
          </button>
        </div>
      </div>

      {/* Список адрес */}
      {filteredAddresses.length === 0 ? (
        <EmptyState
          icon="📍"
          title="Адрес не знайдено"
          hint={search ? `За запитом "${search}" нічого не знайдено` : "Додайте першу адресу до довідника"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAddresses.map((addr) => {
            const isUpdating =
              updateAddress.isPending && updateAddress.variables?.addressId === addr.id;
            return (
              <div
                key={addr.id}
                className="app-card rounded-2xl p-3.5 flex flex-col justify-between gap-3 border transition-all"
                style={{
                  background: addr.is_active ? "var(--app-surface)" : "color-mix(in srgb, #ef4444 4%, var(--app-surface))",
                  borderColor: addr.is_active ? "var(--app-border)" : "color-mix(in srgb, #ef4444 30%, transparent)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm tracking-tight truncate">
                        {addr.street}
                      </h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          addr.is_active
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-rose-500/15 text-rose-600"
                        }`}
                      >
                        {addr.is_active ? "🟢 Доставляємо" : "🔴 Стоплист"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs opacity-60">📍 м. {addr.city}</p>
                    {addr.notes && (
                      <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 opacity-90 italic">
                        💬 {addr.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Нижня панель дій */}
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--app-border)]">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleToggleActive(addr)}
                    className="app-press flex-1 rounded-xl py-1.5 px-3 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs"
                    style={{
                      background: addr.is_active
                        ? "color-mix(in srgb, #ef4444 12%, transparent)"
                        : "color-mix(in srgb, #22c55e 12%, transparent)",
                      color: addr.is_active ? "#ef4444" : "#22c55e",
                      border: `1px solid ${addr.is_active ? "color-mix(in srgb, #ef4444 25%, transparent)" : "color-mix(in srgb, #22c55e 25%, transparent)"}`,
                    }}
                  >
                    <span>{addr.is_active ? "⛔" : "✅"}</span>
                    <span>{addr.is_active ? "У стоплист" : "Відновити доставку"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptic("light");
                      setEditingAddress(addr);
                      setIsModalOpen(true);
                    }}
                    className="app-press rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-2 text-xs opacity-75 hover:opacity-100"
                    title="Редагувати"
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(addr)}
                    className="app-press rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-500 opacity-75 hover:opacity-100"
                    title="Видалити адресу"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальне вікно створення / редагування */}
      {isModalOpen && (
        <DeliveryAddressModal
          initialData={editingAddress}
          onClose={() => {
            setIsModalOpen(false);
            setEditingAddress(null);
          }}
          onSave={(payload) => {
            if (editingAddress) {
              updateAddress.mutate(
                { addressId: editingAddress.id, payload },
                {
                  onSuccess: () => {
                    hapticNotify("success");
                    setIsModalOpen(false);
                    setEditingAddress(null);
                  },
                  onError: () => hapticNotify("error"),
                },
              );
            } else {
              createAddress.mutate(
                {
                  city: payload.city || "Вишгород",
                  street: payload.street || "",
                  is_active: payload.is_active ?? true,
                  notes: payload.notes,
                },
                {
                  onSuccess: () => {
                    hapticNotify("success");
                    setIsModalOpen(false);
                  },
                  onError: () => hapticNotify("error"),
                },
              );
            }
          }}
          isSaving={createAddress.isPending || updateAddress.isPending}
        />
      )}
    </div>
  );
}

function DeliveryAddressModal({
  initialData,
  onClose,
  onSave,
  isSaving,
}: {
  initialData: AdminDeliveryAddress | null;
  onClose: () => void;
  onSave: (payload: { city?: string; street?: string; is_active?: boolean; notes?: string | null }) => void;
  isSaving: boolean;
}) {
  const [city, setCity] = useState(initialData?.city || "Вишгород");
  const [street, setStreet] = useState(initialData?.street || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [isActive, setIsActive] = useState(initialData ? initialData.is_active : true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStreet = street.trim();
    if (!cleanStreet) {
      setError("Вкажіть назву вулиці");
      return;
    }
    setError(null);
    onSave({
      city: city.trim() || "Вишгород",
      street: cleanStreet,
      notes: notes.trim() || null,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 overscroll-contain">
      <div
        className="app-rise w-full max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--app-border)] p-5 pb-8 sm:pb-5 shadow-2xl space-y-4 max-w-md bg-white dark:bg-[#1c1c1e]"
        style={{ background: "var(--tg-theme-bg-color, #ffffff)", color: "var(--tg-theme-text-color, #000000)" }}
      >
        <div className="flex items-center justify-between border-b pb-3 border-[var(--app-border)]">
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>📍</span>
            <span>{initialData ? "Редагування адреси" : "Нова адреса доставки"}</span>
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-sm opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/15 p-3 text-xs text-rose-600 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
              Населений пункт
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
              Вулиця / провулок / проспект *
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="наприклад: вул. Набережна або просп. Шевченка"
              required
              autoFocus
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
              Примітка / причина стоплиста (необов'язково)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="наприклад: Ремонт мосту, тимчасово без заїзду кур'єра"
              rows={2}
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--tg-theme-button-color)]"
            />
            <span className="text-xs font-medium">
              Доставка дозволена (не в стоплисті)
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--app-border)]">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 text-xs font-semibold opacity-70 hover:opacity-100"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="app-press rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow transition"
              style={{ background: "var(--tg-theme-button-color)" }}
            >
              {isSaving ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
