import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { hasAdminAuth, removeAdminToken } from "@/api/client";
import {
  isTelegramWebApp,
  getTelegramStartParam,
  isStartParamConsumed,
  markStartParamConsumed,
} from "@/telegram/env";
import { useAdminMe, useLocations } from "@/api/queries";
import { ErrorBox, Spinner } from "@/components/ui";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { BroadcastsTab } from "@/components/admin/BroadcastsTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { CatalogTab } from "@/components/admin/CatalogTab";
import { OptionGroupsTab } from "@/components/admin/OptionGroupsTab";
import { StopListTab } from "@/components/admin/StopListTab";
import { DeliverySettingsTab } from "@/components/admin/DeliverySettingsTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { ManagersTab } from "@/components/admin/ManagersTab";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic, closeMiniApp } from "@/telegram/sdk";

type AdminSection = "operations" | "management";
type AdminTab =
  | "orders"
  | "stoplist"
  | "delivery"
  | "catalog"
  | "options"
  | "users"
  | "managers"
  | "analytics"
  | "broadcasts";

export function AdminPage() {
  const navigate = useNavigate();
  useBackButton(() => {
    if (isTelegramWebApp()) {
      navigate("/");
    }
  });

  const { data: adminMe, isPending: mePending, error: meError } = useAdminMe();
  const { data: locations = [] } = useLocations();

  const [searchParams, setSearchParams] = useSearchParams();
  const rawOrderId = searchParams.get("order_id") || searchParams.get("edit_order");
  const startParam = getTelegramStartParam();
  const startOrderMatch = startParam?.match(/^(?:order_?)?(\d+)$/i);
  const startOrderId =
    startOrderMatch && !isStartParamConsumed(startParam ?? undefined) ? startOrderMatch[1] : null;

  const [initialOrderId, setInitialOrderId] = useState<number | null>(() => {
    const raw = rawOrderId || startOrderId;
    return raw ? parseInt(raw, 10) : null;
  });

  const handleCloseEditingOrder = () => {
    setInitialOrderId(null);
    markStartParamConsumed();
    if (searchParams.has("order_id") || searchParams.has("edit_order")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("order_id");
          next.delete("edit_order");
          return next;
        },
        { replace: true }
      );
    }
  };

  const [activeSection, setActiveSection] = useState<AdminSection>("operations");
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const isSuperAdmin = adminMe?.role === "admin";

  useEffect(() => {
    if (initialOrderId) {
      setActiveSection("operations");
      setActiveTab("orders");
    }
  }, [initialOrderId]);

  useEffect(() => {
    if (
      adminMe &&
      !isSuperAdmin &&
      (activeTab === "managers" || activeTab === "analytics" || activeTab === "broadcasts")
    ) {
      setActiveTab("orders");
      setActiveSection("operations");
    }
  }, [adminMe, isSuperAdmin, activeTab]);

  // Якщо менеджер прив'язаний до закладу — автоматично фіксуємо локацію
  const effectiveLocationId =
    adminMe?.role === "manager" ? adminMe.location_id : selectedLocationId;

  // Якщо ми у звичайному браузері і немає авторизації адміна — переходимо на екран входу
  if (!isTelegramWebApp() && !hasAdminAuth()) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => {
    removeAdminToken();
    navigate("/admin/login", { replace: true });
  };

  if (mePending) return <Spinner />;

  if (meError) {
    if (!isTelegramWebApp()) {
      removeAdminToken();
      return <Navigate to="/admin/login" replace />;
    }
    return <ErrorBox message={meError.message} onRetry={() => window.location.reload()} />;
  }

  if (!adminMe || !adminMe.is_staff) {
    if (!isTelegramWebApp()) {
      removeAdminToken();
      return <Navigate to="/admin/login" replace />;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl">⛔</div>
        <p className="mt-4 text-lg font-bold">Доступ обмежено</p>
        <p className="mt-2 text-sm opacity-60">
          Цей розділ доступний лише для персоналу та адміністрації закладу.
        </p>
        <button
          onClick={() => navigate("/profile")}
          className="app-press mt-6 rounded-xl px-5 py-2.5 font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Повернутися в профіль
        </button>
      </div>
    );
  }

  const roleLabel = adminMe.role === "admin" ? "👑 Головний адмін" : "👔 Менеджер";
  const locationBadge = adminMe.location_name
    ? `📍 ${adminMe.location_name}`
    : adminMe.role === "admin"
      ? "🌐 Усі заклади"
      : "";

  return (
    <div className="min-h-screen pb-16 md:pb-8 flex flex-col md:flex-row bg-[var(--tg-theme-bg-color)]">
      {/* 💻 ДЕСКТОПНИЙ САЙДБАР (відображається від md:) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-[var(--app-border)] bg-[var(--app-surface)] p-4 min-h-screen sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-2xl border border-amber-500/20">
                🍕
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight">Doma Admin</h1>
                <p className="text-[10px] opacity-60">Панель керування</p>
              </div>
            </div>
            {isTelegramWebApp() && (
              <button
                onClick={() => navigate("/")}
                className="app-press rounded-xl px-2.5 py-1.5 text-xs font-bold border border-[var(--app-border)] bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)] transition-colors flex items-center gap-1"
                title="Перейти до меню ресторану"
              >
                <span>🍽️</span>
                <span className="text-[11px]">Меню</span>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold truncate">
                {adminMe.role === "admin" ? "Головний адмін" : "Менеджер закладу"}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
              >
                {roleLabel}
              </span>
            </div>
            {locationBadge && <p className="text-[11px] opacity-70">{locationBadge}</p>}
          </div>

          {adminMe.role === "admin" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1">
                Заклад
              </label>
              <select
                value={selectedLocationId ?? ""}
                onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-2 text-xs font-medium focus:outline-none"
              >
                <option value="">🌐 Усі заклади</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <nav className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wider opacity-40 px-2 mb-1.5">
              Меню та страви
            </p>
            {[
              { tab: "catalog" as AdminTab, label: "Меню та категорії", icon: "🍕" },
              { tab: "options" as AdminTab, label: "Модифікатори та соуси", icon: "🥫" },
              { tab: "stoplist" as AdminTab, label: "Стоп-лист", icon: "⛔" },
              { tab: "delivery" as AdminTab, label: "Доставка та години", icon: "🛵" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveSection("operations");
                  setActiveTab(item.tab);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all text-left ${
                  activeTab === item.tab && activeSection === "operations"
                    ? "shadow-sm font-bold"
                    : "opacity-70 hover:opacity-100 hover:bg-[var(--app-surface-2)]"
                }`}
                style={
                  activeTab === item.tab && activeSection === "operations"
                    ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                    : undefined
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <p className="text-[9px] font-bold uppercase tracking-wider opacity-40 px-2 pt-3 mb-1.5">
              {isSuperAdmin ? "Керування та аналітика" : "Керування"}
            </p>
            {[
              { tab: "orders" as AdminTab, label: "Замовлення", icon: "📦" },
              ...(isSuperAdmin
                ? [
                    { tab: "analytics" as AdminTab, label: "Аналітика", icon: "📊" },
                    { tab: "broadcasts" as AdminTab, label: "Розсилки", icon: "📢" },
                  ]
                : []),
              { tab: "users" as AdminTab, label: "Клієнти", icon: "👥" },
              ...(isSuperAdmin
                ? [{ tab: "managers" as AdminTab, label: "Штат і ролі", icon: "👔" }]
                : []),
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveSection(item.tab === "orders" ? "operations" : "management");
                  setActiveTab(item.tab);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all text-left ${
                  activeTab === item.tab
                    ? "shadow-sm font-bold"
                    : "opacity-70 hover:opacity-100 hover:bg-[var(--app-surface-2)]"
                }`}
                style={
                  activeTab === item.tab
                    ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                    : undefined
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-3 border-t border-[var(--app-border)]">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <span>🚪</span>
            <span>Вийти з адмінки</span>
          </button>
        </div>
      </aside>

      {/* Головна робоча зона */}
      <main className="flex-1 min-w-0">
        {/* Десктопний верхній бар */}
        <div className="hidden md:flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] px-8 py-3.5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold tracking-tight">
              {activeTab === "catalog" && "🍕 Меню та категорії"}
              {activeTab === "options" && "🥫 Модифікатори та соуси"}
              {activeTab === "stoplist" && "⛔ Стоп-лист страв"}
              {activeTab === "delivery" && "🛵 Налаштування доставки"}
              {activeTab === "orders" && "📦 Замовлення"}
              {activeTab === "analytics" && "📊 Аналітика та статистика"}
              {activeTab === "broadcasts" && "📢 Маркетингові розсилки"}
              {activeTab === "users" && "👥 Клієнти закладу"}
              {activeTab === "managers" && isSuperAdmin && "👔 Штат та ролі"}
            </h2>
            {locationBadge && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "var(--app-surface-2)" }}>
                {locationBadge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isTelegramWebApp() && (
              <button
                onClick={() => navigate("/")}
                className="app-press rounded-xl px-3 py-1.5 text-xs font-bold border border-[var(--app-border)] bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)] transition-colors flex items-center gap-1.5"
              >
                <span>🍽️</span>
                <span>До меню ресторану</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              Вийти
            </button>
          </div>
        </div>

        {/* Мобільна верхня панель */}
        <div className="md:hidden px-4 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isTelegramWebApp() && (
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    navigate("/");
                  }}
                  className="app-press inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold border shadow-sm transition-all shrink-0"
                  style={{
                    background: "var(--app-surface-2)",
                    borderColor: "var(--app-border)",
                    color: "var(--tg-theme-button-color)",
                  }}
                  title="Повернутися до меню ресторану"
                >
                  <span>🍽️</span>
                  <span>До меню</span>
                </button>
              )}
              <h1 className="text-xl font-bold tracking-tight truncate">Адмін-панель</h1>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex flex-col items-end gap-0.5 text-right">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
                >
                  {roleLabel}
                </span>
                {locationBadge && <span className="text-[10px] opacity-60">{locationBadge}</span>}
              </div>
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  handleLogout();
                }}
                className="app-press rounded-xl p-1.5 text-sm border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
                title="Вийти з акаунта адміна"
                aria-label="Вийти з акаунта адміна"
              >
                🚪
              </button>
            </div>
          </div>

        {/* 1. Глобальний перемикач на 2 розділи: Заклад (Менеджер) vs Керування (Штат і Клієнти) */}
        <div
          className="mt-3 grid grid-cols-2 gap-1 rounded-xl p-1 text-xs font-semibold"
          style={{ background: "var(--app-surface-2)" }}
        >
          <button
            onClick={() => {
              haptic("light");
              setActiveSection("operations");
              if (activeTab === "users" || activeTab === "managers") {
                setActiveTab("orders");
              }
            }}
            className={`app-press rounded-lg py-2 text-center transition-all ${
              activeSection === "operations" ? "shadow-sm font-bold" : "opacity-65"
            }`}
            style={
              activeSection === "operations"
                ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                : undefined
            }
          >
            🍕 Заклад (Операційний)
          </button>
          <button
            onClick={() => {
              haptic("light");
              setActiveSection("management");
              if (isSuperAdmin) {
                if (activeTab !== "users" && activeTab !== "managers" && activeTab !== "analytics" && activeTab !== "broadcasts") {
                  setActiveTab("analytics");
                }
              } else {
                setActiveTab("users");
              }
            }}
            className={`app-press rounded-lg py-2 text-center transition-all ${
              activeSection === "management" ? "shadow-sm font-bold" : "opacity-65"
            }`}
            style={
              activeSection === "management"
                ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                : undefined
            }
          >
            {isSuperAdmin ? "📊 Керування та аналітика" : "👥 Клієнти"}
          </button>
        </div>

        {/* 2. Підвкладки розділу "Заклад" */}
        {activeSection === "operations" && (
          <div
            className="mt-2 flex rounded-xl p-1 text-xs font-medium overflow-x-auto no-scrollbar gap-1"
            style={{ background: "var(--app-surface-2)" }}
          >
            <button
              onClick={() => {
                haptic("light");
                setActiveTab("orders");
              }}
              className={`app-press flex-1 min-w-[90px] rounded-lg py-2 text-center transition-all ${
                activeTab === "orders" ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === "orders"
                  ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                  : undefined
              }
            >
              📦 Замовлення
            </button>
            <button
              onClick={() => {
                haptic("light");
                setActiveTab("stoplist");
              }}
              className={`app-press flex-1 min-w-[70px] rounded-lg py-2 text-center transition-all ${
                activeTab === "stoplist" ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === "stoplist"
                  ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                  : undefined
              }
            >
              ⛔ Стоп
            </button>
            <button
              onClick={() => {
                haptic("light");
                setActiveTab("delivery");
              }}
              className={`app-press flex-1 min-w-[80px] rounded-lg py-2 text-center transition-all ${
                activeTab === "delivery" ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === "delivery"
                  ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                  : undefined
              }
            >
              🛵 Доставка
            </button>
            <button
              onClick={() => {
                haptic("light");
                setActiveTab("catalog");
              }}
              className={`app-press flex-1 min-w-[70px] rounded-lg py-2 text-center transition-all ${
                activeTab === "catalog" ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === "catalog"
                  ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                  : undefined
              }
            >
              🍕 Меню
            </button>
            <button
              onClick={() => {
                haptic("light");
                setActiveTab("options");
              }}
              className={`app-press flex-1 min-w-[75px] rounded-lg py-2 text-center transition-all ${
                activeTab === "options" ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === "options"
                  ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                  : undefined
              }
            >
              🧩 Додатки
            </button>
          </div>
        )}

        {/* 2. Підвкладки розділу "Керування та аналітика" */}
        {activeSection === "management" && (
          <div
            className="mt-2 flex rounded-xl p-1 text-xs font-medium gap-1 overflow-x-auto no-scrollbar"
            style={{ background: "var(--app-surface-2)" }}
          >
            {isSuperAdmin && (
              <>
                <button
                  onClick={() => {
                    haptic("light");
                    setActiveTab("analytics");
                  }}
                  className={`app-press flex-1 min-w-[75px] rounded-lg py-2 text-center transition-all ${
                    activeTab === "analytics" ? "shadow-sm font-bold" : "opacity-70"
                  }`}
                  style={
                    activeTab === "analytics"
                      ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                      : undefined
                  }
                >
                  📊 Аналітика
                </button>
                <button
                  onClick={() => {
                    haptic("light");
                    setActiveTab("broadcasts");
                  }}
                  className={`app-press flex-1 min-w-[75px] rounded-lg py-2 text-center transition-all ${
                    activeTab === "broadcasts" ? "shadow-sm font-bold" : "opacity-70"
                  }`}
                  style={
                    activeTab === "broadcasts"
                      ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                      : undefined
                  }
                >
                  📢 Розсилки
                </button>
              </>
            )}
            <button
              onClick={() => {
                haptic("light");
                setActiveTab("users");
              }}
              className={`app-press flex-1 min-w-[75px] rounded-lg py-2 text-center transition-all ${
                activeTab === "users" ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === "users"
                  ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                  : undefined
              }
            >
              👤 Клієнти
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  haptic("light");
                  setActiveTab("managers");
                }}
                className={`app-press flex-1 min-w-[75px] rounded-lg py-2 text-center transition-all ${
                  activeTab === "managers" ? "shadow-sm font-bold" : "opacity-70"
                }`}
                style={
                  activeTab === "managers"
                    ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                    : undefined
                }
              >
                👥 Штат
              </button>
            )}
          </div>
        )}

        {/* Фільтр по закладах для Admin */}
        {adminMe.role === "admin" &&
          (activeTab === "orders" ||
            activeTab === "catalog" ||
            activeTab === "stoplist" ||
            activeTab === "delivery" ||
            activeTab === "analytics") &&
          locations.length > 1 && (
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => {
                  haptic("light");
                  setSelectedLocationId(null);
                }}
                className="app-press shrink-0 rounded-full px-3 py-1.5 font-medium transition-all"
                style={
                  selectedLocationId === null
                    ? {
                        background: "var(--tg-theme-button-color)",
                        color: "var(--tg-theme-button-text-color)",
                      }
                    : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
                }
              >
                Всі заклади
              </button>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    haptic("light");
                    setSelectedLocationId(loc.id);
                  }}
                  className="app-press shrink-0 rounded-full px-3 py-1.5 font-medium transition-all"
                  style={
                    selectedLocationId === loc.id
                      ? {
                          background: "var(--tg-theme-button-color)",
                          color: "var(--tg-theme-button-text-color)",
                        }
                      : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
                  }
                >
                  {loc.name}
                </button>
              ))}
            </div>
          )}
      </div>

      {/* Вміст вкладок */}
      <div className="mt-4 px-4 md:px-8 max-w-7xl pb-12">
        {activeTab === "orders" && (
          <OrdersTab
            locationId={effectiveLocationId}
            initialEditingOrderId={initialOrderId}
            onCloseEditingOrder={handleCloseEditingOrder}
          />
        )}
        {activeTab === "analytics" && isSuperAdmin && (
          <AnalyticsTab locationId={effectiveLocationId} />
        )}
        {activeTab === "broadcasts" && isSuperAdmin && <BroadcastsTab />}
        {activeTab === "catalog" && (
          <CatalogTab
            locationId={effectiveLocationId}
            locations={locations}
            isSuperAdmin={adminMe.role === "admin"}
            userLocationId={adminMe.location_id}
          />
        )}
        {activeTab === "options" && <OptionGroupsTab />}
        {activeTab === "stoplist" && <StopListTab locationId={effectiveLocationId} />}
        {activeTab === "delivery" && (
          <DeliverySettingsTab
            locationId={effectiveLocationId}
            isSuperAdmin={adminMe.role === "admin"}
          />
        )}
        {activeTab === "users" && (
          <UsersTab locations={locations} isSuperAdmin={isSuperAdmin} />
        )}
        {activeTab === "managers" && isSuperAdmin && (
          <ManagersTab locations={locations} />
        )}

        {/* Кнопка повернення до меню ресторану внизу сторінки (мобільна) */}
        <div className="md:hidden mt-8 px-4 pb-6 space-y-2">
          {isTelegramWebApp() && (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                navigate("/");
              }}
              className="app-press w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold shadow-sm transition-all border"
              style={{
                background: "var(--app-surface)",
                borderColor: "var(--app-border)",
                color: "var(--tg-theme-button-color)",
              }}
            >
              <span>🍽️</span>
              <span>Повернутися до меню ресторану</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              haptic("light");
              handleLogout();
            }}
            className="app-press w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
          >
            <span>🚪</span>
            <span>Вийти з акаунта адміна</span>
          </button>
          {isTelegramWebApp() && (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                closeMiniApp();
              }}
              className="app-press w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            >
              <span>✕</span>
              <span>Закрити застосунок</span>
            </button>
          )}
        </div>
      </div>
      </main>
    </div>
  );
}
