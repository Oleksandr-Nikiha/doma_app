import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAdminMe, useMe, useOrders, useUpdateProfile } from "@/api/queries";
import { AddressSelector } from "@/components/delivery/AddressSelector";
import { ErrorBox, ScreenTitle, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function ProfilePage() {
  const navigate = useNavigate();
  const { data: user, isPending, error, refetch } = useMe();
  const { data: adminMe } = useAdminMe();
  const { data: orders } = useOrders();
  const updateProfile = useUpdateProfile();

  const ordersCount = orders?.length ?? 0;
  const activeOrdersCount =
    orders?.filter(
      (o) =>
        o.status !== "completed" &&
        o.status !== "rejected" &&
        o.status !== "cancelled",
    ).length ?? 0;

  const formatActiveBadge = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) {
      return `${count} активне`;
    }
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return `${count} активні`;
    }
    return `${count} активних`;
  };

  // Витягуємо ім'я та прізвище: спочатку з окремих полів, якщо порожні — парсимо full_name
  const initialFirstName = user?.first_name || user?.full_name?.split(" ")[0] || "";
  const initialLastName =
    user?.last_name || (user?.full_name && user.full_name.split(" ").slice(1).join(" ")) || "";

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.delivery_address || "");
  const [additionalAddress, setAdditionalAddress] = useState(user?.additional_address || "");
  const [isEditingMainAddress, setIsEditingMainAddress] = useState(false);
  const [isEditingAdditionalAddress, setIsEditingAdditionalAddress] = useState(false);
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
  if (!user) {
    return (
      <div className="pb-8">
        <ScreenTitle>Профіль</ScreenTitle>
        <div className="app-rise space-y-4 px-4">
          <div className="app-card rounded-2xl p-5 text-center">
            <div className="mb-3 text-4xl">👤</div>
            <h2 className="text-lg font-bold">Гостьовий режим</h2>
            <p className="mt-2 text-xs leading-relaxed opacity-70">
              Ви переглядаєте меню та оформлюєте замовлення як гість.
            </p>
            <div
              className="mt-4 rounded-xl p-3.5 text-left text-xs"
              style={{ background: "var(--app-surface-2)" }}
            >
              <p className="mb-1.5 text-sm font-semibold">🎁 Переваги авторизації:</p>
              <ul className="list-inside list-disc space-y-1 opacity-80">
                <li>Накопичення та списання бонусів</li>
                <li>Автозбереження адрес доставки</li>
                <li>Історія та швидке повторення замовлень</li>
                <li>Миттєві сповіщення про статус у боті</li>
              </ul>
            </div>
            <a
              href="https://t.me"
              target="_blank"
              rel="noreferrer"
              className="app-press mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-transform active:scale-98"
              style={{ background: "var(--tg-theme-button-color)" }}
            >
              <span>Відкрити у боті Telegram</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

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
          setIsEditingMainAddress(false);
          setIsEditingAdditionalAddress(false);
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
        {/* Секція для співробітників: Перехід до Адмін-панелі */}
        {adminMe?.is_staff && (
          <section className="app-rise">
            <div
              className="app-card relative overflow-hidden rounded-2xl p-4 transition-all"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--tg-theme-button-color) 16%, var(--app-surface)), var(--app-surface))",
                border: "1px solid color-mix(in srgb, var(--tg-theme-button-color) 40%, transparent)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {adminMe.role === "admin" ? "👑" : "👔"}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">Адмін-панель</p>
                      <span
                        className="rounded-full px-2 py-0.2 text-[10px] font-bold"
                        style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
                      >
                        {adminMe.role === "admin" ? "Адміністратор" : "Менеджер"}
                      </span>
                    </div>
                    <p className="text-xs opacity-60">
                      {adminMe.location_name ? `Заклад: ${adminMe.location_name}` : "Управління закладами, меню та стоп-листом"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    navigate("/admin");
                  }}
                  className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold"
                  style={{
                    background: "var(--tg-theme-button-color)",
                    color: "var(--tg-theme-button-text-color)",
                    boxShadow: "var(--app-shadow)",
                  }}
                >
                  Відкрити →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Секція: Мої замовлення */}
        <section className="app-rise">
          <div
            onClick={() => {
              haptic("light");
              navigate("/orders");
            }}
            className="app-card app-press flex items-center justify-between rounded-2xl p-4 cursor-pointer transition-all"
            style={{
              background: "var(--app-surface)",
              border: "1px solid var(--app-border)",
            }}
          >
            <div className="flex items-center gap-3.5">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
                style={{ background: "var(--app-tint)" }}
              >
                📦
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">Мої замовлення</p>
                  {activeOrdersCount > 0 ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: "rgba(234, 179, 8, 0.15)", color: "#eab308" }}
                    >
                      {formatActiveBadge(activeOrdersCount)}
                    </span>
                  ) : ordersCount > 0 ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold opacity-60"
                      style={{ background: "var(--app-tint)" }}
                    >
                      {ordersCount}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs opacity-60">
                  {ordersCount > 0
                    ? `Історія та статус ${ordersCount} ${ordersCount === 1 ? "замовлення" : "замовлень"}`
                    : "Історія та статус замовлень"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-40">
              <span className="text-base font-bold">→</span>
            </div>
          </div>
        </section>

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
                    setSavedSuccess(false);
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
                    setSavedSuccess(false);
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

        {/* Секція 3: Картка клієнта */}
        <section className="app-rise space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Картка клієнта</p>

          <div
            className="app-card relative overflow-hidden rounded-3xl p-5 shadow-lg transition-all"
            style={{
              background:
                "linear-gradient(145deg, color-mix(in srgb, var(--tg-theme-button-color) 25%, var(--app-surface)), color-mix(in srgb, var(--tg-theme-button-color) 8%, var(--app-surface)))",
              border: "1px solid color-mix(in srgb, var(--tg-theme-button-color) 35%, transparent)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--tg-theme-button-color)]">
                    DOMA CLUB
                  </span>
                  <span className="text-xs">✨</span>
                </div>
                <p className="mt-1 text-lg font-bold tracking-tight">{user.full_name}</p>
              </div>
              <div
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
              >
                <span>●</span>
                <span>Active</span>
              </div>
            </div>

            <div className="mt-8 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider opacity-50">Номер картки</p>
                <p className="font-mono text-sm font-bold tracking-widest">{clientCode}</p>
              </div>

              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider opacity-50">Бонуси</p>
                <p className="text-xl font-extrabold text-[var(--tg-theme-button-color)]">
                  {bonusBalance} <span className="text-xs font-semibold opacity-70">бал.</span>
                </p>
              </div>
            </div>

            <div className="mt-4 border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
              <p className="text-[11px] opacity-50">
                Бонусна програма: нарахування та оплата замовлень балами у закладах Doma.
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
