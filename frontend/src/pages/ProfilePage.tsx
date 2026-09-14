import { useState } from "react";

import { useMe, useUpdateProfile } from "@/api/queries";
import { ErrorBox, ScreenTitle, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function ProfilePage() {
  const { data: user, isPending, error, refetch } = useMe();
  const updateProfile = useUpdateProfile();

  // Витягуємо ім'я та прізвище: спочатку з окремих полів, якщо порожні — парсимо full_name
  const initialFirstName = user?.first_name || user?.full_name?.split(" ")[0] || "";
  const initialLastName =
    user?.last_name || (user?.full_name && user.full_name.split(" ").slice(1).join(" ")) || "";

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.delivery_address || "");
  const [additionalAddress, setAdditionalAddress] = useState(user?.additional_address || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Оновлюємо внутрішній стан, якщо дані користувача змінилися з сервера
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  if (user && user.id !== loadedUserId) {
    setLoadedUserId(user.id);
    setFirstName(user.first_name || user.full_name?.split(" ")[0] || "");
    setLastName(user.last_name || (user.full_name && user.full_name.split(" ").slice(1).join(" ")) || "");
    setDeliveryAddress(user.delivery_address || "");
    setAdditionalAddress(user.additional_address || "");
  }

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
  if (!user) return null;

  const isDirty =
    firstName.trim() !== (initialFirstName || "").trim() ||
    lastName.trim() !== (initialLastName || "").trim() ||
    deliveryAddress.trim() !== (user.delivery_address || "").trim() ||
    additionalAddress.trim() !== (user.additional_address || "").trim();

  const canSave = firstName.trim().length > 0 && isDirty && !updateProfile.isPending;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setSavedSuccess(false);
    updateProfile.mutate(
      {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        delivery_address: deliveryAddress.trim() || null,
        additional_address: additionalAddress.trim() || null,
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        },
        onError: () => {
          hapticNotify("error");
        },
      },
    );
  };

  const inputStyle = {
    background: "var(--app-surface)",
    color: "var(--tg-theme-text-color)",
  };

  const clientCode = user.client_code || `DM-${user.telegram_id}`;
  const bonusBalance = user.bonus_balance ?? 0;

  return (
    <div className="pb-8">
      <ScreenTitle>Профіль</ScreenTitle>

      <form onSubmit={handleSave} className="space-y-6 px-4 pt-1">
        {/* Секція 1: Мої дані */}
        <section className="app-rise space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Мої дані</p>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium opacity-60">Прізвище</span>
              <input
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setSavedSuccess(false);
                }}
                placeholder="Шевченко"
                className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium opacity-60">Імʼя</span>
              <input
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setSavedSuccess(false);
                }}
                placeholder="Олександр"
                required
                className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium opacity-60">№ Телефону</span>
                <span className="text-[11px] opacity-40">🔒 закріплено</span>
              </div>
              <input
                value={user.phone}
                disabled
                className="mt-1 w-full rounded-xl px-4 py-3 text-sm opacity-60 cursor-not-allowed select-none"
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        {/* Секція 2: Моя адреса */}
        <section className="app-rise space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Моя адреса</p>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium opacity-60">Основна адреса</span>
              <input
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  setSavedSuccess(false);
                }}
                placeholder="Вишгород, вул. Шевченка 1, кв. 2"
                className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium opacity-60">Додаткова адреса</span>
              <input
                value={additionalAddress}
                onChange={(e) => {
                  setAdditionalAddress(e.target.value);
                  setSavedSuccess(false);
                }}
                placeholder="Офіс, робота або адреса рідних"
                className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        {/* Секція 3: Картка клієнта (заглушка під майбутню CRM) */}
        <section className="app-rise space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Картка клієнта</p>

          <div
            className="app-card relative overflow-hidden rounded-2xl p-4 transition-all"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--tg-theme-button-color) 15%, var(--app-surface)), var(--app-surface))",
              border: "1px solid var(--app-border)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--tg-theme-link-color)]">
                  Doma Club
                </span>
                <p className="mt-1 text-base font-bold tracking-tight">{user.full_name}</p>
              </div>
              <span className="rounded-lg px-2 py-0.5 text-[11px] font-medium" style={{ background: "var(--app-tint)", color: "var(--tg-theme-link-color)" }}>
                Active
              </span>
            </div>

            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider opacity-50">ID клієнта</p>
                <p className="font-mono text-sm font-semibold tracking-wider">{clientCode}</p>
              </div>

              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider opacity-50">Бонуси</p>
                <p className="text-lg font-extrabold text-[var(--tg-theme-button-color)]">
                  {bonusBalance} <span className="text-xs font-semibold opacity-70">бонусів</span>
                </p>
              </div>
            </div>

            <div className="mt-4 border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
              <p className="text-[11px] opacity-40">
                Заглушка: накопичення та списання бонусів буде інтегровано з клієнтською системою закладів.
              </p>
            </div>
          </div>
        </section>

        {/* Статус повідомлення про успіх або помилку */}
        {savedSuccess && (
          <p
            className="app-pop rounded-xl px-4 py-2.5 text-center text-xs font-medium"
            style={{ background: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#22c55e" }}
          >
            ✓ Дані успішно збережено
          </p>
        )}

        {updateProfile.isError && (
          <p
            className="rounded-xl px-4 py-2.5 text-center text-xs font-medium"
            style={{ background: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444" }}
          >
            {updateProfile.error.message}
          </p>
        )}

        {/* Кнопка збереження */}
        <button
          type="submit"
          disabled={!canSave}
          onClick={() => haptic("light")}
          className="app-press w-full rounded-xl py-3 font-semibold transition-all disabled:opacity-40"
          style={
            canSave
              ? {
                  background: "var(--tg-theme-button-color)",
                  color: "var(--tg-theme-button-text-color)",
                  boxShadow: "var(--app-shadow)",
                }
              : {
                  background: "var(--app-surface)",
                  color: "currentColor",
                }
          }
        >
          {updateProfile.isPending ? "Зберігаємо…" : "Зберегти зміни"}
        </button>
      </form>
    </div>
  );
}
