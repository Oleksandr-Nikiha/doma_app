import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { hasAdminAuth, removeAdminToken } from "@/api/client";
import { isTelegramWebApp } from "@/telegram/env";
import {
  useAddOptionGroupItem,
  useAdminCategories,
  useAdminLocationsDelivery,
  useAdminManagers,
  useAdminMe,
  useAdminOrderDetail,
  useAdminOrders,
  useAdminOptionGroupItems,
  useAdminOptionGroups,
  useAdminProducts,
  useAdminUsers,
  useAdminVariantChoices,
  useAttachProductOptionGroup,
  useBulkProductAvailability,
  useBulkProductOptionGroups,
  useCreateCategory,
  useCreateManager,
  useCreateOptionGroup,
  useCreateProduct,
  useCreateVariant,
  useDeleteAdminUser,
  useDeleteCategory,
  useDeleteManager,
  useDeleteOptionGroup,
  useDeleteOptionGroupItem,
  useDeleteProduct,
  useDeleteVariant,
  useDetachProductOptionGroup,
  useLocations,
  useNotifyAdminOrder,
  useToggleProductAvailability,
  useToggleVariantAvailability,
  useUpdateAdminOrder,
  useUpdateAdminUser,
  useUpdateCategory,
  useAdminDeliveryAddresses,
  useCreateAdminDeliveryAddress,
  useUpdateAdminDeliveryAddress,
  useDeleteAdminDeliveryAddress,
  useUpdateLocationDelivery,
  useUpdateManager,
  useUpdateOptionGroup,
  useUpdateOptionGroupItem,
  useUpdateProduct,
  useUpdateProductOptionGroup,
  useUpdateVariant,
} from "@/api/queries";
import type {
  AdminCategory,
  AdminDeliveryAddress,
  AdminOptionGroup,
  AdminProduct,
  AdminUser,
  AdminVariant,
  CategoryCreatePayload,
  CategoryUpdatePayload,
  Location,
  LocationDeliverySettings,
  Manager,
  OptionGroupCreatePayload,
  OptionGroupItemCreatePayload,
  OptionGroupUpdatePayload,
  ProductCreatePayload,
  ProductOptionGroupAdmin,
  ProductUpdatePayload,
  VariantCreatePayload,
  VariantUpdatePayload,
} from "@/api/types";
import { EmptyState, ErrorBox, ScreenTitle, Spinner, Thumb, formatPrice } from "@/components/ui";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { BroadcastsTab } from "@/components/admin/BroadcastsTab";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic, hapticNotify } from "@/telegram/sdk";

type AdminSection = "operations" | "management";
type AdminTab = "orders" | "stoplist" | "delivery" | "catalog" | "options" | "users" | "managers" | "analytics" | "broadcasts";

export function AdminPage() {
  const navigate = useNavigate();
  useBackButton(() => navigate("/profile"));

  const { data: adminMe, isPending: mePending, error: meError } = useAdminMe();
  const { data: locations = [] } = useLocations();

  const [activeSection, setActiveSection] = useState<AdminSection>("operations");
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const isSuperAdmin = adminMe?.role === "admin";

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
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-2xl border border-amber-500/20">
              🍕
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Doma Admin</h1>
              <p className="text-[10px] opacity-60">Панель керування</p>
            </div>
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
          <button
            onClick={handleLogout}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            Вийти
          </button>
        </div>

        {/* Мобільна верхня панель */}
        <div className="md:hidden px-4 pt-3">
          <div className="flex items-center justify-between">
            <ScreenTitle>Адмін-панель</ScreenTitle>
          <div className="flex flex-col items-end gap-1 pr-2 pt-2 text-right">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
            >
              {roleLabel}
            </span>
            {locationBadge && <span className="text-[11px] opacity-60">{locationBadge}</span>}
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
          <OrdersTab locationId={effectiveLocationId} />
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
      </div>
      </main>
    </div>
  );
}

// ============================================================================
// 0. ВКЛАДКА ЗАМОВЛЕНЬ (OrdersTab + OrderEditModal)
// ============================================================================

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending_moderation: {
    label: "Очікує модерації",
    bg: "color-mix(in srgb, #f59e0b 20%, transparent)",
    text: "#d97706",
  },
  confirmed: {
    label: "Підтверджено",
    bg: "color-mix(in srgb, #10b981 20%, transparent)",
    text: "#059669",
  },
  in_progress: {
    label: "Готується",
    bg: "color-mix(in srgb, #3b82f6 20%, transparent)",
    text: "#2563eb",
  },
  ready: {
    label: "Готове / В дорозі",
    bg: "color-mix(in srgb, #8b5cf6 20%, transparent)",
    text: "#7c3aed",
  },
  completed: {
    label: "Виконано",
    bg: "color-mix(in srgb, #6b7280 20%, transparent)",
    text: "#4b5563",
  },
  rejected: {
    label: "Відхилено",
    bg: "color-mix(in srgb, #ef4444 20%, transparent)",
    text: "#dc2626",
  },
  cancelled: {
    label: "Скасовано",
    bg: "color-mix(in srgb, #ef4444 20%, transparent)",
    text: "#dc2626",
  },
};

function OrdersTab({
  locationId,
}: {
  locationId?: number | null;
}) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const {
    data: orders = [],
    isPending,
    error,
    refetch,
  } = useAdminOrders({
    status: statusFilter,
    locationId,
  });
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const updateOrder = useUpdateAdminOrder();

  const statusFilters = [
    { key: null, label: "Всі" },
    { key: "pending_moderation", label: "⏳ Очікують" },
    { key: "confirmed", label: "✅ Підтверджені" },
    { key: "in_progress", label: "👨‍🍳 Готуються" },
    { key: "ready", label: "🛵 Готові" },
    { key: "completed", label: "🏁 Виконані" },
    { key: "rejected", label: "❌ Відхилені" },
    { key: "cancelled", label: "🚫 Скасовані" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Замовлення ({orders.length})</h2>
          <p className="text-xs opacity-60">Модерація та зміна складу замовлень</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            void refetch();
          }}
          className="app-press rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--app-surface-2)" }}
        >
          🔄 Оновити
        </button>
      </div>

      {/* Фільтри за статусом */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {statusFilters.map((sf) => (
          <button
            key={String(sf.key)}
            onClick={() => {
              haptic("light");
              setStatusFilter(sf.key);
            }}
            className="app-press shrink-0 rounded-full px-3 py-1.5 font-medium transition-all"
            style={
              statusFilter === sf.key
                ? {
                    background: "var(--tg-theme-button-color)",
                    color: "var(--tg-theme-button-text-color)",
                  }
                : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
            }
          >
            {sf.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} />
      ) : orders.length === 0 ? (
        <EmptyState icon="📦" title="Замовлень немає" hint="Не знайдено замовлень із обраним статусом" />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const sc = STATUS_CONFIG[o.status] || {
              label: o.status,
              bg: "var(--app-surface-2)",
              text: "inherit",
            };
            return (
              <div
                key={o.id}
                className="app-card rounded-2xl p-4 transition-all"
                style={{ border: "1px solid var(--app-border)" }}
              >
                {/* Шапка картки */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">#{o.id}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {sc.label}
                      </span>
                      {o.location_name && (
                        <span className="text-[11px] opacity-60">📍 {o.location_name}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] opacity-50">📅 {o.created_at}</p>
                  </div>

                  <div className="text-right">
                    <span
                      className="text-sm font-bold"
                      style={{ color: "var(--tg-theme-button-color)" }}
                    >
                      {formatPrice(o.total_price)}
                    </span>
                    <p className="text-[11px] opacity-60">
                      {o.payment_method === "cash"
                        ? "💵 Готівка"
                        : o.payment_method === "card"
                        ? "💳 Картка"
                        : "📱 QR"}
                    </p>
                  </div>
                </div>

                {/* Примітка про клієнта */}
                {o.user_admin_note && (
                  <div
                    className="mt-2.5 rounded-xl p-2.5 text-xs"
                    style={{
                      background: "color-mix(in srgb, #f59e0b 15%, transparent)",
                      color: "#b45309",
                    }}
                  >
                    ⚠️ <b>Примітка про клієнта:</b> {o.user_admin_note}
                  </div>
                )}
                {o.user_is_blocked && (
                  <div
                    className="mt-1.5 rounded-xl p-2 text-xs font-semibold"
                    style={{
                      background: "color-mix(in srgb, #ef4444 15%, transparent)",
                      color: "#ef4444",
                    }}
                  >
                    ⛔ Клієнт заблокований в системі!
                  </div>
                )}

                {/* Дані клієнта та доставки */}
                <div className="mt-2.5 space-y-1 text-xs opacity-80">
                  <p>
                    👤 <b>{o.contact_name}</b> (
                    <a href={`tel:${o.contact_phone}`} className="text-blue-500 hover:underline">
                      {o.contact_phone}
                    </a>
                    )
                  </p>
                  <p>
                    {o.fulfillment_type === "delivery"
                      ? `🛵 Доставка: ${o.delivery_address || ""}`
                      : "🛍️ Самовивіз"}
                  </p>
                  <p>
                    ⏰ Час: <b>{o.scheduled_time ? `На ${o.scheduled_time}` : "Якнайшвидше"}</b>
                  </p>
                  {o.comment && <p className="italic opacity-70">💬 {o.comment}</p>}
                </div>

                {/* Список страв */}
                <div
                  className="mt-2.5 rounded-xl p-2.5 text-xs font-medium"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  <p className="opacity-60 mb-0.5 text-[11px]">Страви:</p>
                  <p className="line-clamp-2">{o.items_summary || "Немає позицій"}</p>
                </div>

                {/* Кнопки дій */}
                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <div className="flex items-center gap-1.5">
                    {o.status === "pending_moderation" && (
                      <>
                        <button
                          onClick={() => {
                            haptic("medium");
                            updateOrder.mutate({
                              orderId: o.id,
                              payload: { status: "confirmed" },
                            });
                          }}
                          className="app-press rounded-xl px-3 py-1.5 text-xs font-semibold"
                          style={{
                            background: "var(--tg-theme-button-color)",
                            color: "var(--tg-theme-button-text-color)",
                          }}
                        >
                          ✅ Підтвердити
                        </button>
                        <button
                          onClick={() => {
                            haptic("medium");
                            updateOrder.mutate({
                              orderId: o.id,
                              payload: { status: "rejected" },
                            });
                          }}
                          className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                          style={{
                            background: "color-mix(in srgb, #ef4444 15%, transparent)",
                            color: "#ef4444",
                          }}
                        >
                          ❌ Відхилити
                        </button>
                      </>
                    )}
                    {o.status === "confirmed" && (
                      <button
                        onClick={() => {
                          haptic("light");
                          updateOrder.mutate({
                            orderId: o.id,
                            payload: { status: "in_progress" },
                          });
                        }}
                        className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                        style={{
                          background: "color-mix(in srgb, #3b82f6 15%, transparent)",
                          color: "#3b82f6",
                        }}
                      >
                        👨‍🍳 Готувати
                      </button>
                    )}
                    {o.status === "in_progress" && (
                      <button
                        onClick={() => {
                          haptic("light");
                          updateOrder.mutate({
                            orderId: o.id,
                            payload: { status: "ready" },
                          });
                        }}
                        className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                        style={{
                          background: "color-mix(in srgb, #8b5cf6 15%, transparent)",
                          color: "#8b5cf6",
                        }}
                      >
                        🛵 Готово
                      </button>
                    )}
                    {o.status === "ready" && (
                      <button
                        onClick={() => {
                          haptic("light");
                          updateOrder.mutate({
                            orderId: o.id,
                            payload: { status: "completed" },
                          });
                        }}
                        className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                        style={{
                          background: "color-mix(in srgb, #10b981 15%, transparent)",
                          color: "#10b981",
                        }}
                      >
                        🏁 Виконано
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      haptic("light");
                      setEditingOrderId(o.id);
                    }}
                    className="app-press rounded-xl px-3 py-1.5 text-xs font-semibold border"
                    style={{ borderColor: "var(--app-border)" }}
                  >
                    ✏️ Змінити замовлення
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingOrderId !== null && (
        <OrderEditModal
          orderId={editingOrderId}
          onClose={() => setEditingOrderId(null)}
        />
      )}
    </div>
  );
}

interface OrderItemOptionDraft {
  option_group_name: string;
  option_name: string;
  price_delta: number;
  qty: number;
}

interface OrderItemDraft {
  id?: number;
  variant_id?: number | null;
  product_name: string;
  variant_label: string;
  unit_price: number;
  qty: number;
  options: OrderItemOptionDraft[];
}

function OrderEditModal({
  orderId,
  onClose,
}: {
  orderId: number;
  onClose: () => void;
}) {
  const { data: order, isPending, error } = useAdminOrderDetail(orderId);
  const { data: variantChoices = [] } = useAdminVariantChoices();
  const updateOrder = useUpdateAdminOrder();
  const notifyOrder = useNotifyAdminOrder();

  const [status, setStatus] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [contactName, setContactName] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [addDishOpen, setAddDishOpen] = useState(false);
  const [dishSearch, setDishSearch] = useState("");

  const [targetItemIdx, setTargetItemIdx] = useState<number | null>(null);
  const [optName, setOptName] = useState("");
  const [optGroup, setOptGroup] = useState("Додатки");
  const [optPrice, setOptPrice] = useState("0");

  const [notified, setNotified] = useState(false);

  if (order && !isInitialized) {
    setStatus(order.status);
    setScheduledTime(order.scheduled_time || "");
    setDeliveryAddress(order.delivery_address || "");
    setContactName(order.contact_name);
    setContactPhone(order.contact_phone);
    setComment(order.comment || "");

    const initialItems: OrderItemDraft[] = [];
    for (const g of order.groups) {
      for (const it of g.items) {
        initialItems.push({
          id: it.id,
          variant_id: it.variant_id,
          product_name: it.product_name,
          variant_label: it.variant_label,
          unit_price: it.unit_price,
          qty: it.qty,
          options: it.options.map((o) => ({
            option_group_name: o.option_group_name,
            option_name: o.option_name,
            price_delta: o.price_delta,
            qty: o.qty,
          })),
        });
      }
    }
    setItems(initialItems);
    setIsInitialized(true);
  }

  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const optsTotal = it.options.reduce((oSum, o) => oSum + o.price_delta * o.qty, 0);
      return sum + (it.unit_price + optsTotal) * it.qty;
    }, 0);
  }, [items]);

  const handleSave = () => {
    if (items.length === 0) {
      alert("Замовлення повинно містити щонайменше одну позицію!");
      return;
    }
    haptic("medium");
    updateOrder.mutate(
      {
        orderId,
        payload: {
          status,
          scheduled_time: scheduledTime || null,
          delivery_address: deliveryAddress,
          contact_name: contactName,
          contact_phone: contactPhone,
          comment: comment || null,
          items,
        },
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      },
    );
  };

  const handleNotify = () => {
    haptic("medium");
    notifyOrder.mutate(orderId, {
      onSuccess: () => {
        setNotified(true);
        hapticNotify("success");
        setTimeout(() => setNotified(false), 3000);
      },
    });
  };

  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  if (isPending) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain">
        <div
          className="rounded-2xl p-6 shadow-2xl"
          style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
        >
          <Spinner />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain">
        <div
          className="rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
        >
          <ErrorBox message={error?.message || "Замовлення не знайдено"} onRetry={onClose} />
        </div>
      </div>
    );
  }

  const filteredChoices = variantChoices.filter((vc) => {
    if (!dishSearch) return true;
    const q = dishSearch.toLowerCase();
    return (
      vc.product_name.toLowerCase().includes(q) ||
      vc.variant_label.toLowerCase().includes(q) ||
      (vc.category_name && vc.category_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4 overscroll-contain">
      <div
        className="w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-4 sm:max-w-lg space-y-4 overscroll-contain touch-pan-y shadow-2xl"
        style={{
          background: "var(--tg-theme-bg-color, #ffffff)",
          border: "1px solid var(--app-border)",
          color: "var(--tg-theme-text-color)",
        }}
      >
        {/* Заголовок */}
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div>
            <h3 className="text-base font-bold">Зміна замовлення #{order.id}</h3>
            <p className="text-xs opacity-60">
              {order.fulfillment_type === "delivery" ? "🛵 Доставка" : "🛍️ Самовивіз"} • 📅{" "}
              {order.created_at}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 opacity-50 hover:opacity-100">
            ✕
          </button>
        </div>

        {/* Примітка про клієнта */}
        {order.user_admin_note && (
          <div
            className="rounded-xl p-2.5 text-xs"
            style={{
              background: "color-mix(in srgb, #f59e0b 15%, transparent)",
              color: "#b45309",
            }}
          >
            ⚠️ <b>Примітка про клієнта:</b> {order.user_admin_note}
          </div>
        )}

        {/* Основні параметри */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block mb-1 font-semibold opacity-70">Статус замовлення:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-[var(--app-border)] p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
            >
              <option value="pending_moderation">⏳ Очікує підтвердження</option>
              <option value="confirmed">✅ Підтверджено</option>
              <option value="in_progress">👨‍🍳 Готується</option>
              <option value="ready">🛵 Готове до видачі / доставки</option>
              <option value="completed">🏁 Виконано</option>
              <option value="rejected">❌ Відхилено</option>
              <option value="cancelled">🚫 Скасовано</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-semibold opacity-70">
              ⏰ Бажаний час (10:30-21:30):
            </label>
            <input
              type="time"
              value={scheduledTime}
              min="10:30"
              max="21:30"
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full rounded-xl border border-[var(--app-border)] p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
            />
          </div>
        </div>

        <div className="space-y-2 text-xs">
          {order.fulfillment_type === "delivery" && (
            <div>
              <label className="block mb-1 font-semibold opacity-70">Адреса доставки:</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full rounded-xl p-2.5 font-medium outline-none"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1 font-semibold opacity-70">Ім'я клієнта:</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-xl p-2.5 font-medium outline-none"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold opacity-70">Телефон:</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-xl p-2.5 font-medium outline-none"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 font-semibold opacity-70">Коментар:</label>
            <input
              type="text"
              value={comment}
              placeholder="Коментар клієнта або менеджера..."
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)" }}
            />
          </div>
        </div>

        {/* Блок страв та позицій */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
              Позиції замовлення ({items.length})
            </h4>
            <button
              onClick={() => {
                haptic("light");
                setAddDishOpen(true);
              }}
              className="app-press rounded-xl px-2.5 py-1 text-xs font-semibold"
              style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
            >
              + Додати страву
            </button>
          </div>

          <div className="space-y-2.5">
            {items.map((it, idx) => {
              const optsSum = it.options.reduce((s, o) => s + o.price_delta * o.qty, 0);
              const itemTotal = (it.unit_price + optsSum) * it.qty;

              return (
                <div
                  key={idx}
                  className="rounded-2xl p-3 border space-y-2 text-xs"
                  style={{ borderColor: "var(--app-border)", background: "var(--app-surface-2)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{it.product_name}</p>
                      <p className="opacity-60 text-[11px]">
                        {it.variant_label} • {formatPrice(it.unit_price)}/шт
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-0.5">
                        <button
                          onClick={() => {
                            haptic("light");
                            if (it.qty > 1) {
                              const next = [...items];
                              next[idx].qty -= 1;
                              setItems(next);
                            }
                          }}
                          className="font-bold px-1"
                        >
                          -
                        </button>
                        <span className="font-bold px-1">{it.qty}</span>
                        <button
                          onClick={() => {
                            haptic("light");
                            const next = [...items];
                            next[idx].qty += 1;
                            setItems(next);
                          }}
                          className="font-bold px-1"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-bold min-w-[60px] text-right">
                        {formatPrice(itemTotal)}
                      </span>

                      <button
                        onClick={() => {
                          haptic("light");
                          setItems(items.filter((_, i) => i !== idx));
                        }}
                        className="text-red-500 opacity-60 hover:opacity-100 p-1"
                        title="Видалити"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Додатки до цієї страви */}
                  {it.options.length > 0 && (
                    <div
                      className="space-y-1 pl-2 border-l-2"
                      style={{ borderColor: "var(--tg-theme-button-color)" }}
                    >
                      {it.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className="flex items-center justify-between text-[11px] opacity-75"
                        >
                          <span>
                            ↳ {opt.option_name} {opt.qty > 1 ? `×${opt.qty}` : ""} (+
                            {formatPrice(opt.price_delta * opt.qty)})
                          </span>
                          <button
                            onClick={() => {
                              const next = [...items];
                              next[idx].options = next[idx].options.filter((_, i) => i !== oIdx);
                              setItems(next);
                            }}
                            className="text-red-500 opacity-50 hover:opacity-100 px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      haptic("light");
                      setTargetItemIdx(idx);
                      setOptName("");
                      setOptPrice("0");
                    }}
                    className="text-[11px] font-semibold opacity-60 hover:opacity-100 text-blue-500"
                  >
                    + Додати опцію / соус до страви
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Підсумок */}
        <div
          className="flex items-center justify-between border-t pt-3"
          style={{ borderColor: "var(--app-border)" }}
        >
          <span className="text-sm font-bold">Разом до сплати:</span>
          <span className="text-lg font-bold" style={{ color: "var(--tg-theme-button-color)" }}>
            {formatPrice(calculatedTotal)}
          </span>
        </div>

        {/* Кнопки збереження та сповіщення */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleSave}
            disabled={updateOrder.isPending}
            className="app-press w-full rounded-xl py-3 text-sm font-bold shadow-sm"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            {updateOrder.isPending ? "Збереження..." : "💾 Зберегти зміни"}
          </button>

          <button
            onClick={handleNotify}
            disabled={notifyOrder.isPending || notified}
            className="app-press w-full rounded-xl py-2.5 text-xs font-semibold border"
            style={{ borderColor: "var(--app-border)" }}
          >
            {notified
              ? "✅ Сповіщення надіслано в Telegram!"
              : notifyOrder.isPending
              ? "Надсилання..."
              : "💬 Надіслати оновлений чек клієнту в Telegram"}
          </button>
        </div>

        {/* Модалка вибору страви для додавання */}
        {addDishOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 overscroll-contain">
            <div
              className="w-full max-h-[85dvh] overflow-y-auto rounded-2xl p-4 max-w-sm space-y-3 overscroll-contain touch-pan-y shadow-2xl"
              style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">Додати страву до замовлення</h4>
                <button
                  onClick={() => setAddDishOpen(false)}
                  className="opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                placeholder="🔍 Пошук страви..."
                value={dishSearch}
                onChange={(e) => setDishSearch(e.target.value)}
                className="w-full rounded-xl p-2.5 text-xs outline-none"
                style={{ background: "var(--app-surface-2)" }}
              />

              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {filteredChoices.slice(0, 40).map((vc) => (
                  <button
                    key={vc.variant_id}
                    onClick={() => {
                      haptic("light");
                      setItems([
                        ...items,
                        {
                          variant_id: vc.variant_id,
                          product_name: vc.product_name,
                          variant_label: vc.variant_label,
                          unit_price: vc.price,
                          qty: 1,
                          options: [],
                        },
                      ]);
                      setAddDishOpen(false);
                      setDishSearch("");
                    }}
                    className="app-press flex w-full items-center justify-between rounded-xl p-2 text-left text-xs hover:bg-black/5"
                    style={{ background: "var(--app-surface-2)" }}
                  >
                    <div>
                      <p className="font-bold">{vc.product_name}</p>
                      <p className="opacity-60 text-[10px]">
                        {vc.category_name ? `${vc.category_name} • ` : ""}
                        {vc.variant_label}
                      </p>
                    </div>
                    <span className="font-bold">{formatPrice(vc.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Модалка додавання опції */}
        {targetItemIdx !== null && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 overscroll-contain">
            <div
              className="w-full rounded-2xl p-4 max-w-xs space-y-3 overscroll-contain shadow-2xl"
              style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">Додати опцію / додаток</h4>
                <button
                  onClick={() => setTargetItemIdx(null)}
                  className="opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block mb-1 font-semibold opacity-70">Назва групи:</label>
                  <input
                    type="text"
                    value={optGroup}
                    onChange={(e) => setOptGroup(e.target.value)}
                    className="w-full rounded-xl p-2 outline-none"
                    style={{ background: "var(--app-surface-2)" }}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-semibold opacity-70">
                    Назва додатку / соусу:
                  </label>
                  <input
                    type="text"
                    placeholder="Наприклад: Сирний бортик, Соус"
                    value={optName}
                    onChange={(e) => setOptName(e.target.value)}
                    className="w-full rounded-xl p-2 outline-none"
                    style={{ background: "var(--app-surface-2)" }}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-semibold opacity-70">Доплата (₴):</label>
                  <input
                    type="number"
                    value={optPrice}
                    onChange={(e) => setOptPrice(e.target.value)}
                    className="w-full rounded-xl p-2 outline-none"
                    style={{ background: "var(--app-surface-2)" }}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setTargetItemIdx(null)}
                  className="app-press flex-1 rounded-xl py-2 text-xs font-semibold"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  Скасувати
                </button>
                <button
                  onClick={() => {
                    if (!optName.trim()) return;
                    haptic("light");
                    const next = [...items];
                    next[targetItemIdx].options.push({
                      option_group_name: optGroup.trim() || "Додатки",
                      option_name: optName.trim(),
                      price_delta: parseFloat(optPrice) || 0,
                      qty: 1,
                    });
                    setItems(next);
                    setTargetItemIdx(null);
                  }}
                  className="app-press flex-1 rounded-xl py-2 text-xs font-semibold"
                  style={{
                    background: "var(--tg-theme-button-color)",
                    color: "var(--tg-theme-button-text-color)",
                  }}
                >
                  Додати
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 0.1. ВКЛАДКА КЛІЄНТІВ (UsersTab + UserCard)
// ============================================================================

function UsersTab({
  locations = [],
  isSuperAdmin = false,
}: {
  locations?: Location[];
  isSuperAdmin?: boolean;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const { data: users = [], isPending, error } = useAdminUsers(query);
  const [staffModalUser, setStaffModalUser] = useState<AdminUser | null>(null);

  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold">База клієнтів ({users.length})</h2>
        <p className="text-xs opacity-60">
          Пошук за номером телефону, ім'ям або Telegram ID, блокування та керування доступом
        </p>
      </div>

      {/* Пошук за номером телефону */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Номер телефону (+380...), ім'я або Telegram ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl p-3 pr-8 text-xs font-medium outline-none transition focus:ring-2 focus:ring-blue-500"
            style={{ background: "var(--app-surface-2)" }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setQuery("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm opacity-40 hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          className="app-press rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
          }}
        >
          🔍 Пошук
        </button>
      </form>

      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} />
      ) : users.length === 0 ? (
        <EmptyState
          icon="👤"
          title="Користувачів не знайдено"
          hint="Спробуйте змінити критерії пошуку"
        />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isSuperAdmin={isSuperAdmin}
              onToggleBlock={() => {
                const action = u.is_blocked ? "розблокувати" : "заблокувати";
                if (
                  window.confirm(
                    `Ви впевнені, що хочете ${action} користувача ${u.full_name}?`,
                  )
                ) {
                  updateUser.mutate({ userId: u.id, payload: { is_blocked: !u.is_blocked } });
                }
              }}
              onTogglePhoneVerified={() => {
                updateUser.mutate({
                  userId: u.id,
                  payload: { is_phone_verified: !u.is_phone_verified },
                });
              }}
              onSaveNote={(note) => {
                updateUser.mutate({ userId: u.id, payload: { admin_note: note } });
              }}
              onDelete={
                isSuperAdmin
                  ? () => {
                      if (
                        window.confirm(
                          `Видалити користувача ${u.full_name} (${u.phone})? Будуть видалені всі його дані та замовлення.`,
                        )
                      ) {
                        deleteUser.mutate(u.id);
                      }
                    }
                  : undefined
              }
              onPromoteToStaff={isSuperAdmin ? () => setStaffModalUser(u) : undefined}
              isUpdating={updateUser.isPending}
              isDeleting={deleteUser.isPending}
            />
          ))}
        </div>
      )}

      {isSuperAdmin && staffModalUser && (
        <ManagerModal
          manager={null}
          initialUser={staffModalUser}
          locations={locations}
          onClose={() => setStaffModalUser(null)}
        />
      )}
    </div>
  );
}

function UserCard({
  user,
  isSuperAdmin,
  onToggleBlock,
  onTogglePhoneVerified,
  onSaveNote,
  onDelete,
  onPromoteToStaff,
  isUpdating,
  isDeleting,
}: {
  user: AdminUser;
  isSuperAdmin?: boolean;
  onToggleBlock: () => void;
  onTogglePhoneVerified: () => void;
  onSaveNote: (note: string) => void;
  onDelete?: () => void;
  onPromoteToStaff?: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [note, setNote] = useState(user.admin_note || "");
  const [isNoteDirty, setIsNoteDirty] = useState(false);
  const [copiedTid, setCopiedTid] = useState(false);

  const handleCopyTid = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic("light");
    const tidStr = String(user.telegram_id);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(tidStr).then(() => {
        setCopiedTid(true);
        setTimeout(() => setCopiedTid(false), 2000);
      });
    } else {
      const el = document.createElement("textarea");
      el.value = tidStr;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedTid(true);
      setTimeout(() => setCopiedTid(false), 2000);
    }
  };

  return (
    <div
      className="app-card rounded-2xl p-4 transition-all"
      style={{
        border: user.is_blocked ? "1px solid #ef4444" : "1px solid var(--app-border)",
        background: user.is_blocked
          ? "color-mix(in srgb, #ef4444 6%, var(--app-surface))"
          : "var(--app-surface)",
      }}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-base shrink-0">{user.is_blocked ? "⛔" : "👤"}</span>
            <span className="text-sm font-bold break-words leading-snug" title={user.full_name}>
              {user.full_name}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: user.is_blocked
                  ? "color-mix(in srgb, #ef4444 20%, transparent)"
                  : "color-mix(in srgb, #10b981 20%, transparent)",
                color: user.is_blocked ? "#ef4444" : "#10b981",
              }}
            >
              {user.is_blocked ? "Заблоковано" : "Активний"}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: user.is_phone_verified
                  ? "color-mix(in srgb, #10b981 15%, transparent)"
                  : "color-mix(in srgb, #f59e0b 15%, transparent)",
                color: user.is_phone_verified ? "#059669" : "#d97706",
              }}
            >
              {user.is_phone_verified ? "✓ Верифіковано" : "⚠️ Не верифіковано"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs opacity-80">
            <a href={`tel:${user.phone}`} className="font-semibold text-blue-500 hover:underline">
              📞 {user.phone}
            </a>
            <button
              type="button"
              onClick={handleCopyTid}
              title="Натисніть, щоб скопіювати Telegram ID"
              className="app-press inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-mono font-semibold transition border cursor-pointer"
              style={{
                background: copiedTid
                  ? "color-mix(in srgb, #10b981 20%, var(--app-surface-2))"
                  : "var(--app-surface-2)",
                color: copiedTid ? "#10b981" : "inherit",
                borderColor: copiedTid ? "#10b981" : "var(--app-border)",
              }}
            >
              <span>🆔 {user.telegram_id}</span>
              <span className="text-[10px] font-sans font-medium">
                {copiedTid ? "✓ Скопійовано" : "📋"}
              </span>
            </button>
            <span>🛍️ Замовлень: {user.orders_count}</span>
            <span>📅 {user.created_at}</span>
          </div>
          {user.delivery_address && (
            <p className="mt-1 text-xs opacity-60 break-words">📍 Адреса: {user.delivery_address}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start justify-end">
          {onPromoteToStaff && (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                onPromoteToStaff();
              }}
              title="Призначити співробітником"
              className="app-press flex h-8 items-center justify-center gap-1 rounded-xl px-2 sm:px-2.5 text-xs font-semibold transition"
              style={{
                background: "color-mix(in srgb, #3b82f6 15%, transparent)",
                color: "#3b82f6",
              }}
            >
              <span>👔</span>
              <span className="hidden sm:inline">У персонал</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              haptic("light");
              const action = user.is_phone_verified
                ? "зняти верифікацію телефону"
                : "встановити верифікацію телефону";
              if (
                window.confirm(
                  `Ви впевнені, що хочете ${action} для клієнта ${user.full_name}? ${
                    user.is_phone_verified
                      ? "Клієнт зможе самостійно змінити свій номер у профілі."
                      : ""
                  }`,
                )
              ) {
                onTogglePhoneVerified();
              }
            }}
            disabled={isUpdating}
            title={
              user.is_phone_verified
                ? "Зняти верифікацію (дозволити клієнту змінити телефон)"
                : "Позначити телефон як верифікований"
            }
            className="app-press flex h-8 items-center justify-center gap-1 rounded-xl px-2 sm:px-2.5 text-xs font-semibold transition"
            style={{
              background: user.is_phone_verified
                ? "color-mix(in srgb, #f59e0b 15%, transparent)"
                : "color-mix(in srgb, #10b981 15%, transparent)",
              color: user.is_phone_verified ? "#d97706" : "#059669",
            }}
          >
            <span>{user.is_phone_verified ? "📱✕" : "📱✓"}</span>
            <span className="hidden sm:inline">
              {user.is_phone_verified ? "Зняти верифікацію" : "Верифікувати"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onToggleBlock();
            }}
            disabled={isUpdating}
            title={user.is_blocked ? "Розблокувати клієнта" : "Заблокувати клієнта"}
            className="app-press flex h-8 w-8 items-center justify-center rounded-xl text-sm transition"
            style={{
              background: user.is_blocked
                ? "color-mix(in srgb, #10b981 15%, transparent)"
                : "color-mix(in srgb, #ef4444 15%, transparent)",
              color: user.is_blocked ? "#10b981" : "#ef4444",
            }}
          >
            <span>{user.is_blocked ? "🔓" : "🚫"}</span>
          </button>
          {isSuperAdmin && onDelete && (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                onDelete();
              }}
              disabled={isDeleting}
              title="Видалити"
              className="app-press flex h-8 w-8 items-center justify-center rounded-xl text-sm transition opacity-80 hover:opacity-100"
              style={{
                background: "color-mix(in srgb, #ef4444 12%, var(--app-surface-2))",
                border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
              }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Поле примітки до профілю */}
      <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-semibold opacity-70">
            📝 Примітка до профілю (надходить менеджеру для підтвердження):
          </label>
          {isNoteDirty && (
            <button
              onClick={() => {
                haptic("medium");
                onSaveNote(note);
                setIsNoteDirty(false);
              }}
              disabled={isUpdating}
              className="app-press rounded-lg px-2 py-0.5 text-[11px] font-bold"
              style={{
                background: "var(--tg-theme-button-color)",
                color: "var(--tg-theme-button-text-color)",
              }}
            >
              Зберегти
            </button>
          )}
        </div>
        <textarea
          value={note}
          rows={2}
          placeholder="Наприклад: Постійний клієнт, просить не дзвонити у двері"
          onChange={(e) => {
            setNote(e.target.value);
            setIsNoteDirty(true);
          }}
          className="w-full rounded-xl p-2.5 text-xs outline-none transition focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--app-surface-2)" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 1. ВКЛАДКА КАТАЛОГУ (Категорії + Страви + Варіанти + Додатки)
// ============================================================================

function CatalogTab({
  locationId,
  locations,
  isSuperAdmin,
  userLocationId,
}: {
  locationId?: number | null;
  locations: Location[];
  isSuperAdmin: boolean;
  userLocationId?: number | null;
}) {
  const { data: categories = [], isPending: catLoading, error: catError } = useAdminCategories(locationId);
  const [selectedParentCatId, setSelectedParentCatId] = useState<number | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const rootCategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === null)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [categories]
  );
  const subcategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id !== null)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [categories]
  );

  const selectedParentCat = useMemo(
    () => (selectedParentCatId ? rootCategories.find((c) => c.id === selectedParentCatId) : null),
    [rootCategories, selectedParentCatId]
  );
  const selectedSubCat = useMemo(
    () => (selectedSubCatId ? subcategories.find((c) => c.id === selectedSubCatId) : null),
    [subcategories, selectedSubCatId]
  );

  const effectiveCategoryId = selectedSubCatId || selectedParentCatId || null;

  const { data: products = [], isPending: prodLoading, error: prodError } = useAdminProducts({
    categoryId: effectiveCategoryId,
    locationId: locationId,
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description ? p.description.toLowerCase().includes(q) : false;
      const matchCat = p.category_name ? p.category_name.toLowerCase().includes(q) : false;
      const matchVariant = p.variants?.some((v) => v.label.toLowerCase().includes(q)) ?? false;
      return matchName || matchDesc || matchCat || matchVariant;
    });
  }, [products, search]);

  // Модальні вікна
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);

  const [subcatModalOpen, setSubcatModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<AdminCategory | null>(null);

  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [targetProductForVariant, setTargetProductForVariant] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<AdminVariant | null>(null);

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [targetProductForOptions, setTargetProductForOptions] = useState<AdminProduct | null>(null);

  // Масові операції (Bulk)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [bulkOptionsModalOpen, setBulkOptionsModalOpen] = useState(false);
  const bulkAvailability = useBulkProductAvailability();

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    haptic("light");
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredProducts.map((p) => p.id));
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newSet = new Set([...selectedProductIds, ...filteredProducts.map((p) => p.id)]);
      setSelectedProductIds(Array.from(newSet));
    }
  };

  const deleteCategory = useDeleteCategory();
  const deleteProduct = useDeleteProduct();
  const deleteVariant = useDeleteVariant();

  if (catLoading) return <Spinner />;
  if (catError) return <ErrorBox message={catError.message} />;

  const defaultLocation = locationId || userLocationId || (locations[0]?.id ?? 1);

  return (
    <div className="space-y-6">
      {/* 1. Блок категорій (Надкатегорії) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Категорії ({rootCategories.length})</h2>
            <p className="text-[11px] opacity-60">Основні розділи меню (Піца, Суші, Закуски...)</p>
          </div>
          <button
            onClick={() => {
              haptic("light");
              setEditingCategory(null);
              setCatModalOpen(true);
            }}
            className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
          >
            <span>+</span> Категорія
          </button>
        </div>

        {/* Скрол списку категорій */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar md:flex-wrap">
          <button
            onClick={() => {
              haptic("light");
              setSelectedParentCatId(null);
              setSelectedSubCatId(null);
            }}
            className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all"
            style={
              selectedParentCatId === null
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
            }
          >
            Всі розділи
          </button>
          {rootCategories.map((c) => {
            const isSelected = selectedParentCatId === c.id;
            return (
              <div
                key={c.id}
                className="flex shrink-0 items-center overflow-hidden rounded-xl border text-xs transition-all"
                style={{
                  borderColor: isSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                  background: isSelected ? "var(--app-tint)" : "var(--app-surface)",
                }}
              >
                <button
                  onClick={() => {
                    haptic("light");
                    setSelectedParentCatId(c.id);
                    setSelectedSubCatId(null);
                  }}
                  className="px-3 py-2 font-medium flex items-center gap-1"
                >
                  {c.icon && <span>{c.icon}</span>}
                  <span>{c.name}</span>
                </button>
                <button
                  onClick={() => {
                    haptic("light");
                    setEditingCategory(c);
                    setCatModalOpen(true);
                  }}
                  title="Редагувати категорію"
                  className="px-2 py-2 opacity-40 hover:opacity-100"
                >
                  ✏️
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Блок підкатегорій */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">
              Підкатегорії {selectedParentCat ? `(${selectedParentCat.name})` : `(${subcategories.length})`}
            </h2>
            <p className="text-[11px] opacity-60">Підрозділи страв без власних емодзі</p>
          </div>
          <button
            onClick={() => {
              haptic("light");
              setEditingSubcategory(null);
              setSubcatModalOpen(true);
            }}
            className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
          >
            <span>+</span> Підкатегорія
          </button>
        </div>

        {/* Скрол списку підкатегорій */}
        {(() => {
          const visibleSubcats = selectedParentCatId
            ? subcategories.filter((s) => s.parent_id === selectedParentCatId)
            : subcategories;

          if (selectedParentCatId && visibleSubcats.length === 0) {
            return (
              <div
                className="rounded-xl border border-dashed p-3 text-center text-xs opacity-50"
                style={{ borderColor: "var(--app-border)" }}
              >
                У категорії «{selectedParentCat?.name}» немає підкатегорій. Натисніть «+ Підкатегорія», щоб створити.
              </div>
            );
          }

          if (!selectedParentCatId && visibleSubcats.length === 0) {
            return (
              <div
                className="rounded-xl border border-dashed p-3 text-center text-xs opacity-50"
                style={{ borderColor: "var(--app-border)" }}
              >
                Немає створених підкатегорій
              </div>
            );
          }

          return (
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar md:flex-wrap">
              {selectedParentCatId && (
                <button
                  onClick={() => {
                    haptic("light");
                    setSelectedSubCatId(null);
                  }}
                  className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all"
                  style={
                    selectedSubCatId === null
                      ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                      : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
                  }
                >
                  Всі в {selectedParentCat?.name}
                </button>
              )}
              {visibleSubcats.map((sub) => {
                const isSelected = selectedSubCatId === sub.id;
                const parentOfSub = rootCategories.find((r) => r.id === sub.parent_id);
                return (
                  <div
                    key={sub.id}
                    className="flex shrink-0 items-center overflow-hidden rounded-xl border text-xs transition-all"
                    style={{
                      borderColor: isSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                      background: isSelected ? "var(--app-tint)" : "var(--app-surface)",
                    }}
                  >
                    <button
                      onClick={() => {
                        haptic("light");
                        setSelectedSubCatId(sub.id);
                        if (sub.parent_id && selectedParentCatId !== sub.parent_id) {
                          setSelectedParentCatId(sub.parent_id);
                        }
                      }}
                      className="px-3 py-2 font-medium flex items-center"
                    >
                      {!selectedParentCatId && parentOfSub && (
                        <span className="opacity-50 mr-1">{parentOfSub.name} →</span>
                      )}
                      <span>{sub.name}</span>
                      <span className="ml-1 opacity-50">({sub.products_count})</span>
                    </button>
                    <button
                      onClick={() => {
                        haptic("light");
                        setEditingSubcategory(sub);
                        setSubcatModalOpen(true);
                      }}
                      title="Редагувати підкатегорію"
                      className="px-2 py-2 opacity-40 hover:opacity-100"
                    >
                      ✏️
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* 3. Блок страв */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">
            Страви{" "}
            {selectedSubCat
              ? `в «${selectedSubCat.name}»`
              : selectedParentCat
              ? `в «${selectedParentCat.name}» (всі)`
              : "(всі)"}{" "}
            <span className="text-xs font-normal opacity-60">
              ({filteredProducts.length}
              {search.trim() ? ` з ${products.length}` : ""})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="app-press rounded-xl px-2.5 py-1.5 text-xs font-medium border transition-colors"
                style={{
                  borderColor: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                  background: allFilteredSelected ? "var(--app-tint)" : "var(--app-surface)",
                  color: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--tg-theme-text-color)",
                }}
              >
                {allFilteredSelected ? "✓ Вибрано всі" : "Вибрати всі"}
              </button>
            )}
            <button
              onClick={() => {
                haptic("light");
                setEditingProduct(null);
                setProdModalOpen(true);
              }}
              className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              <span>+</span> Страва
            </button>
          </div>
        </div>

        {/* Швидкий пошук страв у меню */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Швидкий пошук страви за назвою, описом або складом..."
            className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 pl-10 text-sm outline-none transition focus:border-[var(--tg-theme-button-color)] focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
            style={{ color: "var(--tg-theme-text-color)" }}
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm opacity-50">
            🔍
          </span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs opacity-50 hover:opacity-100"
              title="Очистити пошук"
            >
              ✕
            </button>
          )}
        </div>

        {prodLoading ? (
          <Spinner />
        ) : prodError ? (
          <ErrorBox message={prodError.message} />
        ) : products.length === 0 ? (
          <EmptyState icon="🍕" title="Немає страв" hint="Додайте першу страву за допомогою кнопки вище" />
        ) : filteredProducts.length === 0 ? (
          <div className="app-card rounded-2xl p-6 text-center space-y-3">
            <span className="text-3xl">🔍</span>
            <p className="font-bold text-sm">Нічого не знайдено</p>
            <p className="text-xs opacity-60">
              За запитом «{search}» не знайдено жодної страви. Спробуйте змінити пошуковий запит або обрати іншу категорію.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="app-press rounded-xl px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--app-surface-2)" }}
            >
              Скинути пошук
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => {
              const isSelected = selectedProductIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className="app-card rounded-2xl p-3.5 transition-all"
                  style={{
                    border: isSelected
                      ? "2px solid var(--tg-theme-button-color)"
                      : "1px solid var(--app-border)",
                    background: isSelected
                      ? "color-mix(in srgb, var(--tg-theme-button-color) 7%, var(--app-surface))"
                      : "var(--app-surface)",
                    opacity: p.is_available ? 1 : 0.65,
                  }}
                >
                  <div className="flex gap-3 items-start">
                    <div className="pt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          haptic("light");
                          toggleSelectProduct(p.id);
                        }}
                        className="h-4 w-4 rounded cursor-pointer accent-[var(--tg-theme-button-color)]"
                      />
                    </div>
                    <Thumb src={p.image_url} className="h-16 w-16 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            haptic("light");
                            setEditingProduct(p);
                            setProdModalOpen(true);
                          }}
                          className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
                          title="Редагувати"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Видалити страву "${p.name}"?`)) {
                              hapticNotify("warning");
                              deleteProduct.mutate(p.id);
                            }
                          }}
                          className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
                          title="Видалити"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {p.description && (
                      <p className="line-clamp-2 mt-0.5 text-xs opacity-60">{p.description}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] opacity-50">
                      <span>{p.category_name}</span>
                      {p.location_name && <span>• 📍 {p.location_name}</span>}
                    </div>
                  </div>
                </div>

                {/* Варіанти цін (розміри / порції) */}
                <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
                  <div className="flex items-center justify-between text-xs font-semibold opacity-70">
                    <span>Розміри та ціни:</span>
                    <button
                      onClick={() => {
                        haptic("light");
                        setTargetProductForVariant(p.id);
                        setEditingVariant(null);
                        setVariantModalOpen(true);
                      }}
                      className="text-[var(--tg-theme-button-color)] hover:underline"
                    >
                      + Додати розмір
                    </button>
                  </div>

                  <div className="mt-1.5 space-y-1.5">
                    {p.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                        style={{
                          background: "var(--app-surface-2)",
                          opacity: v.is_available ? 1 : 0.5,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{v.label}</span>
                          {v.weight && <span className="opacity-50">({v.weight})</span>}
                          {!v.is_available && (
                            <span className="rounded bg-red-500/20 px-1 py-0.2 text-[10px] text-red-500 font-bold">
                              СТОП
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{v.price.toFixed(0)} ₴</span>
                          <button
                            onClick={() => {
                              haptic("light");
                              setTargetProductForVariant(p.id);
                              setEditingVariant(v);
                              setVariantModalOpen(true);
                            }}
                            className="opacity-50 hover:opacity-100 text-[11px]"
                          >
                            ✏️
                          </button>
                          {p.variants.length > 1 && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Видалити варіант "${v.label}"?`)) {
                                  hapticNotify("warning");
                                  deleteVariant.mutate(v.id);
                                }
                              }}
                              className="opacity-50 hover:opacity-100 text-[11px]"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Додатки (Модифікатори до страви) */}
                <div className="mt-2.5 border-t pt-2" style={{ borderColor: "var(--app-border)" }}>
                  <div className="flex items-center justify-between text-xs font-semibold opacity-70">
                    <span>Додатки до страви:</span>
                    <button
                      onClick={() => {
                        haptic("light");
                        setTargetProductForOptions(p);
                        setOptionsModalOpen(true);
                      }}
                      className="text-[var(--tg-theme-button-color)] hover:underline"
                    >
                      ⚙️ Налаштувати
                    </button>
                  </div>

                  {p.option_groups && p.option_groups.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.option_groups.map((og) => (
                        <span
                          key={og.group_id}
                          className="rounded-lg px-2.5 py-1 text-[11px] font-medium"
                          style={{ background: "var(--app-surface-2)" }}
                        >
                          🧩 {og.group_name}{" "}
                          <span className="opacity-60">
                            ({og.min_select}–{og.max_select}
                            {og.free_count > 0 ? `, б/к: ${og.free_count}` : ""})
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] opacity-40">Немає додатків (натисніть Налаштувати)</p>
                  )}
                </div>
              </div>
            );})}
          </div>
        )}
      </section>

      {/* Плаваюча панель масових дій */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg">
          <div
            className="app-card rounded-2xl p-3 shadow-2xl border flex flex-col gap-2.5 backdrop-blur-md"
            style={{
              background: "color-mix(in srgb, var(--tg-theme-bg-color) 94%, black)",
              borderColor: "var(--tg-theme-button-color)",
            }}
          >
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold">
                Обрано страв: <span className="text-[var(--tg-theme-button-color)] font-extrabold">{selectedProductIds.length}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedProductIds([])}
                className="opacity-60 hover:opacity-100 font-medium"
              >
                ✕ Зняти вибір
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={bulkAvailability.isPending}
                onClick={() => {
                  haptic("medium");
                  bulkAvailability.mutate(
                    { product_ids: selectedProductIds, is_available: false },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                      },
                    },
                  );
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-red-500/30 bg-red-500/10 text-red-500 disabled:opacity-50"
              >
                ⛔ На стоп
              </button>

              <button
                type="button"
                disabled={bulkAvailability.isPending}
                onClick={() => {
                  haptic("medium");
                  bulkAvailability.mutate(
                    { product_ids: selectedProductIds, is_available: true },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                      },
                    },
                  );
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 disabled:opacity-50"
              >
                ✓ Доступно
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  setBulkOptionsModalOpen(true);
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center"
                style={{
                  background: "var(--tg-theme-button-color)",
                  color: "var(--tg-theme-button-text-color)",
                }}
              >
                🧩 Додатки
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальне вікно масового налаштування додатків */}
      {bulkOptionsModalOpen && selectedProductIds.length > 0 && (
        <BulkProductOptionsModal
          productIds={selectedProductIds}
          onClose={() => setBulkOptionsModalOpen(false)}
          onSuccess={() => {
            setSelectedProductIds([]);
          }}
        />
      )}

      {/* Модальне вікно Категорії */}
      {catModalOpen && (
        <CategoryModal
          category={editingCategory}
          locations={locations}
          defaultLocationId={defaultLocation}
          isSuperAdmin={isSuperAdmin}
          existingCategories={categories}
          onClose={() => setCatModalOpen(false)}
          onDelete={(id) => {
            deleteCategory.mutate(id);
            setCatModalOpen(false);
          }}
        />
      )}

      {/* Модальне вікно Підкатегорії */}
      {subcatModalOpen && (
        <SubcategoryModal
          subcategory={editingSubcategory}
          rootCategories={rootCategories}
          defaultParentId={selectedParentCatId}
          existingCategories={categories}
          onClose={() => setSubcatModalOpen(false)}
          onDelete={(id) => {
            deleteCategory.mutate(id);
            setSubcatModalOpen(false);
          }}
        />
      )}

      {/* Модальне вікно Страви */}
      {prodModalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          defaultCategoryId={effectiveCategoryId || categories[0]?.id || 1}
          onClose={() => setProdModalOpen(false)}
        />
      )}

      {/* Модальне вікно Варіанту ціни */}
      {variantModalOpen && targetProductForVariant && (
        <VariantModal
          productId={targetProductForVariant}
          variant={editingVariant}
          onClose={() => {
            setVariantModalOpen(false);
            setTargetProductForVariant(null);
            setEditingVariant(null);
          }}
        />
      )}

      {/* Модальне вікно налаштування додатків для страви */}
      {optionsModalOpen && targetProductForOptions && (
        <ProductOptionsModal
          product={targetProductForOptions}
          onClose={() => {
            setOptionsModalOpen(false);
            setTargetProductForOptions(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// 2. ВКЛАДКА ГРУП ДОДАТКІВ (Створення, соуси, топінги, ціни)
// ============================================================================

function OptionGroupsTab() {
  const { data: groups = [], isPending, error } = useAdminOptionGroups();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminOptionGroup | null>(null);

  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  const deleteGroup = useDeleteOptionGroup();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Групи додатків ({groups.length})</h2>
          <p className="text-xs opacity-60">Соуси, сирні бортики, напої та інгредієнти</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            setEditingGroup(null);
            setModalOpen(true);
          }}
          className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          <span>+</span> Нова група
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="🧩" title="Немає груп додатків" hint="Створіть першу групу додатків, наприклад: 'Соуси' або 'Додатки до піци'" />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <OptionGroupCard
              key={g.id}
              group={g}
              onEdit={() => {
                setEditingGroup(g);
                setModalOpen(true);
              }}
              onDelete={() => {
                if (window.confirm(`Видалити групу "${g.name}"? Її буде вилучено з усіх страв.`)) {
                  hapticNotify("warning");
                  deleteGroup.mutate(g.id);
                }
              }}
              onAddItem={() => {
                setActiveGroupId(g.id);
                setAddItemModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Модалка створення/редагування групи */}
      {modalOpen && (
        <OptionGroupModal
          group={editingGroup}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Модалка додавання позиції в групу */}
      {addItemModalOpen && activeGroupId && (
        <AddOptionItemModal
          groupId={activeGroupId}
          onClose={() => {
            setAddItemModalOpen(false);
            setActiveGroupId(null);
          }}
        />
      )}
    </div>
  );
}

function OptionGroupCard({
  group,
  onEdit,
  onDelete,
  onAddItem,
}: {
  group: AdminOptionGroup;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: items = [], isPending: itemsLoading } = useAdminOptionGroupItems(expanded ? group.id : 0);

  const deleteItem = useDeleteOptionGroupItem();
  const updateItem = useUpdateOptionGroupItem();

  return (
    <div
      className="app-card rounded-2xl p-3.5 transition-all"
      style={{ border: "1px solid var(--app-border)" }}
    >
      <div className="flex items-center justify-between">
        <div
          onClick={() => {
            haptic("light");
            setExpanded(!expanded);
          }}
          className="flex-1 cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate">{group.name}</span>
            <span className="text-xs opacity-50">{expanded ? "▲" : "▼"}</span>
          </div>
          <p className="text-[11px] opacity-60">
            {group.items_count} позицій • підключено до {group.products_count} страв
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
            title="Редагувати"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
            title="Видалити"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Розгорнутий список позицій у групі */}
      {expanded && (
        <div className="mt-3 border-t pt-2.5 space-y-2" style={{ borderColor: "var(--app-border)" }}>
          <div className="flex items-center justify-between text-xs font-semibold opacity-70">
            <span>Позиції та доплати:</span>
            <button
              onClick={onAddItem}
              className="text-[var(--tg-theme-button-color)] hover:underline"
            >
              + Додати позицію
            </button>
          </div>

          {itemsLoading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <p className="text-xs opacity-50 py-1">Група порожня. Додайте соуси або топінги.</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((it) => (
                <div
                  key={it.variant_id}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs"
                  style={{
                    background: "var(--app-surface-2)",
                    opacity: it.is_available ? 1 : 0.5,
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">{it.product_name}</p>
                    <p className="text-[10px] opacity-60">{it.variant_label}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold">
                      {it.price_delta > 0 ? `+${it.price_delta.toFixed(0)} ₴` : "0 ₴"}
                    </span>
                    <button
                      onClick={() => {
                        haptic("light");
                        updateItem.mutate({
                          groupId: group.id,
                          variantId: it.variant_id,
                          payload: { is_available: !it.is_available },
                        });
                      }}
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: it.is_available
                          ? "color-mix(in srgb, #22c55e 15%, transparent)"
                          : "color-mix(in srgb, #ef4444 15%, transparent)",
                        color: it.is_available ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {it.is_available ? "Активна" : "Стоп"}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Вилучити "${it.product_name}" з групи?`)) {
                          hapticNotify("warning");
                          deleteItem.mutate({ groupId: group.id, variantId: it.variant_id });
                        }
                      }}
                      className="opacity-50 hover:opacity-100 text-xs pl-1"
                      title="Вилучити"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. ВКЛАДКА СТОП-ЛИСТУ (Швидке перемикання наявності)
// ============================================================================

function StopListTab({ locationId }: { locationId?: number | null }) {
  const { data: products = [], isPending, error } = useAdminProducts({ locationId });
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const toggleProduct = useToggleProductAvailability();
  const toggleVariant = useToggleVariantAvailability();
  const bulkAvailability = useBulkProductAvailability();

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  const categoryNames = Array.from(new Set(products.map((p) => p.category_name).filter(Boolean))) as string[];

  const filtered = products.filter((p) => {
    const matchSearch =
      search.trim() === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category_name && p.category_name.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCategory === null || p.category_name === filterCategory;
    return matchSearch && matchCat;
  });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    haptic("light");
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filtered.map((p) => p.id));
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newSet = new Set([...selectedProductIds, ...filtered.map((p) => p.id)]);
      setSelectedProductIds(Array.from(newSet));
    }
  };

  const stoppedCount = products.filter(
    (p) => !p.is_available || p.variants.some((v) => !v.is_available),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Швидкий Стоп-лист</h2>
          <p className="text-xs opacity-60">
            {stoppedCount > 0
              ? `У стоп-листі: ${stoppedCount} позицій`
              : "Всі страви в наявності"}
          </p>
        </div>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={toggleSelectAll}
            className="app-press rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors"
            style={{
              borderColor: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
              background: allFilteredSelected ? "var(--app-tint)" : "var(--app-surface)",
              color: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--tg-theme-text-color)",
            }}
          >
            {allFilteredSelected ? "✓ Вибрано всі" : "Вибрати всі"}
          </button>
        )}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Швидкий пошук страви чи напою..."
        className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
        style={{ background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }}
      />

      {categoryNames.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => {
              haptic("light");
              setFilterCategory(null);
            }}
            className="app-press shrink-0 rounded-full px-3 py-1 font-medium"
            style={
              filterCategory === null
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
            }
          >
            Всі ({products.length})
          </button>
          {categoryNames.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                haptic("light");
                setFilterCategory(cat);
              }}
              className="app-press shrink-0 rounded-full px-3 py-1 font-medium"
              style={
                filterCategory === cat
                  ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                  : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((p) => {
          const isSelected = selectedProductIds.includes(p.id);
          return (
            <div
              key={p.id}
              className="app-card rounded-2xl p-3.5 transition-all"
              style={{
                border: isSelected
                  ? "2px solid var(--tg-theme-button-color)"
                  : "1px solid var(--app-border)",
                background: isSelected
                  ? "color-mix(in srgb, var(--tg-theme-button-color) 8%, var(--app-surface))"
                  : !p.is_available
                  ? "color-mix(in srgb, #ef4444 8%, var(--app-surface))"
                  : "var(--app-surface)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      haptic("light");
                      toggleSelectProduct(p.id);
                    }}
                    className="h-4 w-4 rounded cursor-pointer accent-[var(--tg-theme-button-color)] shrink-0"
                  />
                  <Thumb src={p.image_url} className="h-12 w-12 shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="text-[11px] opacity-50">{p.category_name}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    haptic("medium");
                    toggleProduct.mutate({ productId: p.id, isAvailable: !p.is_available });
                  }}
                  className="app-press shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-colors"
                  style={
                    p.is_available
                      ? { background: "color-mix(in srgb, #22c55e 18%, transparent)", color: "#16a34a" }
                      : { background: "color-mix(in srgb, #ef4444 25%, transparent)", color: "#dc2626" }
                  }
                >
                  {p.is_available ? "✓ Доступно" : "⛔ НА СТОПІ"}
                </button>
              </div>

              {p.variants.length > 0 && (
                <div className="mt-3 border-t pt-2 space-y-1.5" style={{ borderColor: "var(--app-border)" }}>
                  <p className="text-[11px] font-semibold opacity-60">Окремі розміри/порції:</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {p.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                        style={{ background: "var(--app-surface-2)" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{v.label}</span>
                          {v.weight && <span className="opacity-50">({v.weight})</span>}
                          <span className="font-bold opacity-80">{v.price.toFixed(0)} ₴</span>
                        </div>
                        <button
                          disabled={!p.is_available}
                          onClick={() => {
                            haptic("light");
                            toggleVariant.mutate({ variantId: v.id, isAvailable: !v.is_available });
                          }}
                          className="app-press rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-40"
                          style={
                            v.is_available && p.is_available
                              ? { background: "color-mix(in srgb, #22c55e 15%, transparent)", color: "#16a34a" }
                              : { background: "color-mix(in srgb, #ef4444 20%, transparent)", color: "#dc2626" }
                          }
                        >
                          {v.is_available && p.is_available ? "Доступний" : "На стопі"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Плаваюча панель масових дій у стоп-листі */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg">
          <div
            className="app-card rounded-2xl p-3 shadow-2xl border flex flex-col gap-2.5 backdrop-blur-md"
            style={{
              background: "color-mix(in srgb, var(--tg-theme-bg-color) 94%, black)",
              borderColor: "var(--tg-theme-button-color)",
            }}
          >
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold">
                Обрано страв: <span className="text-[var(--tg-theme-button-color)] font-extrabold">{selectedProductIds.length}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedProductIds([])}
                className="opacity-60 hover:opacity-100 font-medium"
              >
                ✕ Зняти вибір
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={bulkAvailability.isPending}
                onClick={() => {
                  haptic("medium");
                  bulkAvailability.mutate(
                    { product_ids: selectedProductIds, is_available: false },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                      },
                    },
                  );
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-red-500/30 bg-red-500/10 text-red-500 disabled:opacity-50"
              >
                ⛔ Поставити на стоп
              </button>

              <button
                type="button"
                disabled={bulkAvailability.isPending}
                onClick={() => {
                  haptic("medium");
                  bulkAvailability.mutate(
                    { product_ids: selectedProductIds, is_available: true },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                      },
                    },
                  );
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 disabled:opacity-50"
              >
                ✓ Зняти зі стопу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. ВКЛАДКА ШТАТУ / МЕНЕДЖЕРІВ (Тільки для Admin)
// ============================================================================

function ManagersTab({ locations }: { locations: Location[] }) {
  const { data: adminMe } = useAdminMe();
  if (adminMe && adminMe.role !== "admin") {
    return (
      <ErrorBox message="Доступ обмежено. Розділ доступний лише для головного адміністратора." />
    );
  }

  const { data: managers = [], isPending, error } = useAdminManagers();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);

  const updateManager = useUpdateManager();
  const deleteManager = useDeleteManager();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Співробітники ({managers.length})</h2>
          <p className="text-xs opacity-60">Управління доступом до адмінки та модерації</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            setEditingManager(null);
            setModalOpen(true);
          }}
          className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          <span>+</span> Додати
        </button>
      </div>

      <div className="space-y-2.5">
        {managers.map((m) => {
          const isSuper = m.role === "admin";
          return (
            <div
              key={m.id}
              className="app-card rounded-2xl p-3.5 transition-all"
              style={{
                border: "1px solid var(--app-border)",
                opacity: m.is_active ? 1 : 0.5,
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{isSuper ? "👑" : "👔"}</span>
                    <span className="text-sm font-bold">{m.full_name}</span>
                    <span
                      className="rounded-full px-2 py-0.2 text-[10px] font-bold"
                      style={{
                        background: isSuper
                          ? "color-mix(in srgb, #f59e0b 20%, transparent)"
                          : "var(--app-tint)",
                        color: isSuper ? "#d97706" : "var(--tg-theme-button-color)",
                      }}
                    >
                      {isSuper ? "Адміністратор" : "Менеджер"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs opacity-70">📞 {m.phone}</p>
                  <p className="text-[11px] opacity-50">
                    ID: {m.telegram_id} {m.location_name && `• 📍 ${m.location_name}`}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => {
                      haptic("light");
                      updateManager.mutate({
                        managerId: m.id,
                        payload: { is_active: !m.is_active },
                      });
                    }}
                    className="app-press rounded-lg px-2 py-1 text-[11px] font-bold"
                    style={{
                      background: m.is_active
                        ? "color-mix(in srgb, #22c55e 15%, transparent)"
                        : "color-mix(in srgb, #ef4444 15%, transparent)",
                      color: m.is_active ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {m.is_active ? "Активний" : "Вимкнений"}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        haptic("light");
                        setEditingManager(m);
                        setModalOpen(true);
                      }}
                      className="opacity-60 hover:opacity-100 text-xs"
                      title="Редагувати"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Видалити співробітника ${m.full_name}?`)) {
                          hapticNotify("warning");
                          deleteManager.mutate(m.id);
                        }
                      }}
                      className="opacity-60 hover:opacity-100 text-xs"
                      title="Видалити"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <ManagerModal
          manager={editingManager}
          locations={locations}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// МОДАЛЬНІ ВІКНА (Форми)
// ============================================================================

function ProductOptionsModal({
  product,
  onClose,
}: {
  product: AdminProduct;
  onClose: () => void;
}) {
  const { data: allGroups = [] } = useAdminOptionGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [minSelect, setMinSelect] = useState("0");
  const [maxSelect, setMaxSelect] = useState("3");
  const [freeCount, setFreeCount] = useState("0");

  const attachGroup = useAttachProductOptionGroup();
  const updateGroup = useUpdateProductOptionGroup();
  const detachGroup = useDetachProductOptionGroup();

  const handleAttach = (e: React.FormEvent) => {
    e.preventDefault();
    const gId = parseInt(selectedGroupId, 10);
    if (!gId) return;

    attachGroup.mutate(
      {
        productId: product.id,
        payload: {
          group_id: gId,
          min_select: parseInt(minSelect, 10) || 0,
          max_select: parseInt(maxSelect, 10) || 1,
          free_count: parseInt(freeCount, 10) || 0,
        },
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          setSelectedGroupId("");
          setMinSelect("0");
          setMaxSelect("3");
          setFreeCount("0");
        },
      },
    );
  };

  const attached = product.option_groups || [];
  const attachedIds = new Set(attached.map((a) => a.group_id));
  const availableToAttach = allGroups.filter((g) => !attachedIds.has(g.id));

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Додатки до страви</h3>
            <p className="text-xs opacity-60">«{product.name}»</p>
          </div>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        {/* Список вже прив'язаних груп */}
        <div className="space-y-2">
          <span className="text-xs font-bold opacity-70">Прикріплені групи додатків:</span>
          {attached.length === 0 ? (
            <p className="text-xs opacity-50 py-1">Ще немає прив'язаних додатків.</p>
          ) : (
            attached.map((og: ProductOptionGroupAdmin) => (
              <AttachedGroupRow
                key={og.group_id}
                item={og}
                onUpdate={(payload) => updateGroup.mutate({ productId: product.id, groupId: og.group_id, payload })}
                onDetach={() => detachGroup.mutate({ productId: product.id, groupId: og.group_id })}
              />
            ))
          )}
        </div>

        {/* Форма прив'язки нової групи */}
        {availableToAttach.length > 0 && (
          <form onSubmit={handleAttach} className="rounded-xl border p-3 space-y-3" style={{ borderColor: "var(--app-border)" }}>
            <span className="text-xs font-bold opacity-80">+ Прикріпити нову групу:</span>

            <label className="block text-xs">
              <span className="opacity-60">Група додатків</span>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">-- Виберіть групу --</option>
                {availableToAttach.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.items_count} поз.)
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <label className="block">
                <span className="opacity-60 text-[10px]">Мін. вибір</span>
                <input
                  type="number"
                  min="0"
                  value={minSelect}
                  onChange={(e) => setMinSelect(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="block">
                <span className="opacity-60 text-[10px]">Макс. вибір</span>
                <input
                  type="number"
                  min="1"
                  value={maxSelect}
                  onChange={(e) => setMaxSelect(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="block">
                <span className="opacity-60 text-[10px]">Безкоштовно</span>
                <input
                  type="number"
                  min="0"
                  value={freeCount}
                  onChange={(e) => setFreeCount(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!selectedGroupId}
              className="app-press w-full rounded-xl py-2 text-xs font-bold disabled:opacity-40"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Прикріпити до страви
            </button>
          </form>
        )}

        <button
          onClick={onClose}
          className="app-press w-full rounded-xl py-2.5 text-xs font-bold"
          style={{ background: "var(--app-surface-2)" }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}

function AttachedGroupRow({
  item,
  onUpdate,
  onDetach,
}: {
  item: ProductOptionGroupAdmin;
  onUpdate: (payload: { min_select: number; max_select: number; free_count: number }) => void;
  onDetach: () => void;
}) {
  const [min, setMin] = useState(String(item.min_select));
  const [max, setMax] = useState(String(item.max_select));
  const [free, setFree] = useState(String(item.free_count));
  const [dirty, setDirty] = useState(false);

  const handleSave = () => {
    onUpdate({
      min_select: parseInt(min, 10) || 0,
      max_select: parseInt(max, 10) || 1,
      free_count: parseInt(free, 10) || 0,
    });
    setDirty(false);
    hapticNotify("success");
  };

  const inputStyle = { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="rounded-xl p-2.5 space-y-2 text-xs" style={{ background: "var(--app-surface-2)" }}>
      <div className="flex items-center justify-between">
        <span className="font-bold">🧩 {item.group_name}</span>
        <button
          onClick={() => {
            if (window.confirm(`Відв'язати групу "${item.group_name}" від страви?`)) {
              onDetach();
            }
          }}
          className="opacity-50 hover:opacity-100 text-red-500 font-medium"
        >
          Відкріпити
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="opacity-50 text-[10px]">Мін (0=опц.)</span>
          <input
            type="number"
            min="0"
            value={min}
            onChange={(e) => {
              setMin(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="opacity-50 text-[10px]">Макс (к-сть)</span>
          <input
            type="number"
            min="1"
            value={max}
            onChange={(e) => {
              setMax(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="opacity-50 text-[10px]">Безкоштовно</span>
          <input
            type="number"
            min="0"
            value={free}
            onChange={(e) => {
              setFree(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
      </div>

      {dirty && (
        <button
          onClick={handleSave}
          className="app-press w-full rounded-lg py-1 font-bold text-[11px]"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Зберегти ліміти
        </button>
      )}
    </div>
  );
}

function BulkProductOptionsModal({
  productIds,
  onClose,
  onSuccess,
}: {
  productIds: number[];
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { data: allGroups = [] } = useAdminOptionGroups();
  const [action, setAction] = useState<"attach" | "detach" | "clear">("attach");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [minSelect, setMinSelect] = useState("0");
  const [maxSelect, setMaxSelect] = useState("3");
  const [freeCount, setFreeCount] = useState("0");

  const bulkOptions = useBulkProductOptionGroups();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action === "attach") {
      const gId = parseInt(selectedGroupId, 10);
      if (!gId) return;
      bulkOptions.mutate(
        {
          action: "attach",
          product_ids: productIds,
          group_id: gId,
          min_select: parseInt(minSelect, 10) || 0,
          max_select: parseInt(maxSelect, 10) || 1,
          free_count: parseInt(freeCount, 10) || 0,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onSuccess?.();
            onClose();
          },
        },
      );
    } else if (action === "detach") {
      const gId = parseInt(selectedGroupId, 10);
      if (!gId) return;
      bulkOptions.mutate(
        {
          action: "detach",
          product_ids: productIds,
          group_id: gId,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onSuccess?.();
            onClose();
          },
        },
      );
    } else if (action === "clear") {
      if (!window.confirm(`Видалити ВСІ додатки з ${productIds.length} вибраних страв?`)) return;
      bulkOptions.mutate(
        {
          action: "clear",
          product_ids: productIds,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onSuccess?.();
            onClose();
          },
        },
      );
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Масова зміна додатків</h3>
            <p className="text-xs opacity-60">Обрано страв: {productIds.length}</p>
          </div>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        {/* Перемикач типу дії */}
        <div
          className="grid grid-cols-3 gap-1 rounded-xl p-1 text-xs font-semibold"
          style={{ background: "var(--app-surface-2)" }}
        >
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setAction("attach");
            }}
            className="rounded-lg py-1.5 transition-all text-center"
            style={
              action === "attach"
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { opacity: 0.6 }
            }
          >
            ➕ Додати
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setAction("detach");
            }}
            className="rounded-lg py-1.5 transition-all text-center"
            style={
              action === "detach"
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { opacity: 0.6 }
            }
          >
            🗑️ Відкріпити
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setAction("clear");
            }}
            className="rounded-lg py-1.5 transition-all text-center"
            style={
              action === "clear"
                ? { background: "#ef4444", color: "#ffffff" }
                : { opacity: 0.6 }
            }
          >
            ❌ Очистити
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {action === "attach" && (
            <div className="space-y-3">
              <label className="block text-xs">
                <span className="opacity-60">Виберіть групу додатків</span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                >
                  <option value="">-- Виберіть групу --</option>
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.items_count} поз.)
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="block">
                  <span className="opacity-60 text-[10px]">Мін. вибір</span>
                  <input
                    type="number"
                    min="0"
                    value={minSelect}
                    onChange={(e) => setMinSelect(e.target.value)}
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="opacity-60 text-[10px]">Макс. вибір</span>
                  <input
                    type="number"
                    min="1"
                    value={maxSelect}
                    onChange={(e) => setMaxSelect(e.target.value)}
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="opacity-60 text-[10px]">Безкоштовно</span>
                  <input
                    type="number"
                    min="0"
                    value={freeCount}
                    onChange={(e) => setFreeCount(e.target.value)}
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
              </div>
              <p className="text-[11px] opacity-50">
                Цю групу буде прикріплено до всіх {productIds.length} вибраних страв із зазначеними правилами вибору. Якщо група вже була прикріплена, правила оновляться.
              </p>
            </div>
          )}

          {action === "detach" && (
            <div className="space-y-3">
              <label className="block text-xs">
                <span className="opacity-60">Яку групу додатків відкріпити?</span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                >
                  <option value="">-- Виберіть групу для відкріплення --</option>
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] opacity-50">
                Вказану групу додатків буде відкріплено від усіх {productIds.length} вибраних страв.
              </p>
            </div>
          )}

          {action === "clear" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 space-y-2 text-xs">
              <p className="font-bold text-red-500">⚠️ Увага!</p>
              <p className="opacity-80">
                З усіх {productIds.length} вибраних страв буде безповоротно видалено будь-які прикріплені групи додатків.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="app-press flex-1 rounded-xl py-2.5 text-xs font-semibold"
              style={{ background: "var(--app-surface-2)" }}
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={
                bulkOptions.isPending ||
                (action !== "clear" && !selectedGroupId)
              }
              className="app-press flex-1 rounded-xl py-2.5 text-xs font-bold disabled:opacity-40"
              style={{
                background: action === "clear" ? "#ef4444" : "var(--tg-theme-button-color)",
                color: "#ffffff",
              }}
            >
              {bulkOptions.isPending ? "Застосування..." : "Застосувати"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OptionGroupModal({
  group,
  onClose,
}: {
  group: AdminOptionGroup | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name || "");
  const [sortOrder, setSortOrder] = useState(group?.sort_order ?? 0);

  const createGroup = useCreateOptionGroup();
  const updateGroup = useUpdateOptionGroup();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (group) {
      const payload: OptionGroupUpdatePayload = {
        name: name.trim(),
        sort_order: Number(sortOrder),
      };
      updateGroup.mutate(
        { groupId: group.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: OptionGroupCreatePayload = {
        name: name.trim(),
        sort_order: Number(sortOrder),
      };
      createGroup.mutate(payload, {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      });
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{group ? "Редагування групи" : "Нова група додатків"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва групи додатків</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Соус до піци, Додатки, Напої..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">Порядок сортування</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddOptionItemModal({
  groupId,
  onClose,
}: {
  groupId: number;
  onClose: () => void;
}) {
  const { data: choices = [], isPending } = useAdminVariantChoices();
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [priceDelta, setPriceDelta] = useState<string>("0");
  const [search, setSearch] = useState("");

  const addItem = useAddOptionGroupItem();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vId = parseInt(selectedVariantId, 10);
    if (!vId) return;

    const payload: OptionGroupItemCreatePayload = {
      variant_id: vId,
      price_delta: parseFloat(priceDelta) || 0,
      sort_order: 0,
      is_available: true,
    };

    addItem.mutate(
      { groupId, payload },
      {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      },
    );
  };

  const filteredChoices = choices.filter(
    (c) =>
      search.trim() === "" ||
      c.product_name.toLowerCase().includes(search.toLowerCase()) ||
      c.variant_label.toLowerCase().includes(search.toLowerCase()),
  );

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Додати позицію в групу</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <span className="opacity-60">Пошук страви/соусу</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Фільтр страв..."
              className="mt-1 w-full rounded-xl px-3 py-2 text-xs outline-none"
              style={inputStyle}
            />
          </div>

          <label className="block">
            <span className="opacity-60">Виберіть варіант товару</span>
            {isPending ? (
              <Spinner />
            ) : (
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">-- Оберіть товар зі списку --</option>
                {filteredChoices.map((c) => (
                  <option key={c.variant_id} value={c.variant_id}>
                    {c.product_name} ({c.variant_label}) - {c.price.toFixed(0)} ₴
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block">
            <span className="opacity-60">Доплата як додаток (₴)</span>
            <input
              type="number"
              step="any"
              value={priceDelta}
              onChange={(e) => setPriceDelta(e.target.value)}
              placeholder="20 (0 = без доплати)"
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
            <span className="mt-1 block text-[10px] opacity-50">
              Ця сума додається до ціни страви при виборі даного додатку.
            </span>
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={!selectedVariantId}
              className="app-press flex-1 rounded-xl py-2.5 font-bold disabled:opacity-40"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Додати в групу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({
  category,
  locations,
  defaultLocationId,
  isSuperAdmin,
  existingCategories,
  onClose,
  onDelete,
}: {
  category: AdminCategory | null;
  locations: Location[];
  defaultLocationId: number;
  isSuperAdmin: boolean;
  existingCategories: AdminCategory[];
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [icon, setIcon] = useState(category?.icon || "🍕");
  const [isVisible, setIsVisible] = useState(category?.is_visible ?? true);
  const [locId, setLocId] = useState(category?.location_id || defaultLocationId);

  const currentRootCats = useMemo(
    () => existingCategories.filter((c) => c.parent_id === null && c.location_id === Number(locId)),
    [existingCategories, locId]
  );
  const lastOrder = useMemo(
    () => (currentRootCats.length > 0 ? Math.max(...currentRootCats.map((c) => c.sort_order)) : 0),
    [currentRootCats]
  );

  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? (lastOrder + 1));

  useEffect(() => {
    if (!category) {
      setSortOrder(lastOrder + 1);
    }
  }, [lastOrder, category]);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (category) {
      const payload: CategoryUpdatePayload = {
        name: name.trim(),
        icon: icon.trim() || null,
        parent_id: null,
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };
      if (isSuperAdmin) payload.location_id = Number(locId);

      updateCategory.mutate(
        { categoryId: category.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: CategoryCreatePayload = {
        name: name.trim(),
        location_id: Number(locId),
        parent_id: null,
        icon: icon.trim() || null,
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };

      createCategory.mutate(payload, {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      });
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{category ? "Редагування категорії" : "Нова категорія"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Піца, Напої, Десерти..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="opacity-60">Іконка (емодзі)</span>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🍕"
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-center outline-none"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="opacity-60">Порядок (останній: {lastOrder})</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>
          </div>
          <p className="text-[10px] opacity-50">
            Якщо вписати порядковий номер у середину списку, наступні категорії автоматично зсунуться на +1.
          </p>

          {isSuperAdmin && (
            <label className="block">
              <span className="opacity-60">Заклад</span>
              <select
                value={locId}
                onChange={(e) => setLocId(Number(e.target.value))}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="font-medium">Видима для клієнтів</span>
          </label>

          <div className="flex gap-2 pt-3">
            {category && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Видалити категорію "${category.name}" та всі її страви?`)) {
                    onDelete(category.id);
                  }
                }}
                className="app-press rounded-xl px-4 py-2.5 font-semibold text-red-500 bg-red-500/10"
              >
                Видалити
              </button>
            )}
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubcategoryModal({
  subcategory,
  rootCategories,
  defaultParentId,
  existingCategories,
  onClose,
  onDelete,
}: {
  subcategory: AdminCategory | null;
  rootCategories: AdminCategory[];
  defaultParentId?: number | null;
  existingCategories: AdminCategory[];
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const [parentId, setParentId] = useState<number>(
    subcategory?.parent_id || defaultParentId || (rootCategories[0]?.id ?? 1)
  );
  const [name, setName] = useState(subcategory?.name || "");

  const selectedParent = useMemo(
    () => rootCategories.find((c) => c.id === Number(parentId)),
    [rootCategories, parentId]
  );

  const currentSubcats = useMemo(
    () => existingCategories.filter((c) => c.parent_id === Number(parentId)),
    [existingCategories, parentId]
  );

  const lastOrder = useMemo(
    () => (currentSubcats.length > 0 ? Math.max(...currentSubcats.map((c) => c.sort_order)) : 0),
    [currentSubcats]
  );

  const [sortOrder, setSortOrder] = useState<number>(
    subcategory?.sort_order ?? (lastOrder + 1)
  );
  const [isVisible, setIsVisible] = useState(subcategory?.is_visible ?? true);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  useEffect(() => {
    if (!subcategory) {
      setSortOrder(lastOrder + 1);
    }
  }, [lastOrder, subcategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !parentId) return;

    if (subcategory) {
      const payload: CategoryUpdatePayload = {
        name: name.trim(),
        parent_id: Number(parentId),
        icon: null, // У підкатегорій немає емодзі
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };
      if (selectedParent) {
        payload.location_id = selectedParent.location_id;
      }

      updateCategory.mutate(
        { categoryId: subcategory.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        }
      );
    } else {
      if (!selectedParent) return;
      const payload: CategoryCreatePayload = {
        name: name.trim(),
        location_id: selectedParent.location_id,
        parent_id: Number(parentId),
        icon: null, // У підкатегорій немає емодзі
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };

      createCategory.mutate(payload, {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      });
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {subcategory ? "Редагування підкатегорії" : "Нова підкатегорія"}
          </h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Батьківська категорія</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(Number(e.target.value))}
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              {rootCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}{c.name} ({c.location_name || ""})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="opacity-60">Назва підкатегорії</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Фірмові, Ролліни, Сети з ролів..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div>
            <label className="block">
              <span className="opacity-60">
                Порядок сортування (останній у категорії: {lastOrder})
              </span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>
            <p className="text-[10px] opacity-50 mt-1">
              Якщо вписати номер у середину списку, наступні підкатегорії зсунуться на +1.
            </p>
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="font-medium">Видима для клієнтів</span>
          </label>

          <div className="flex gap-2 pt-3">
            {subcategory && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Видалити підкатегорію "${subcategory.name}" та всі її страви?`)) {
                    onDelete(subcategory.id);
                  }
                }}
                className="app-press rounded-xl px-4 py-2.5 font-semibold text-red-500 bg-red-500/10"
              >
                Видалити
              </button>
            )}
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductModal({
  product,
  categories,
  defaultCategoryId,
  onClose,
}: {
  product: AdminProduct | null;
  categories: AdminCategory[];
  defaultCategoryId: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(product?.category_id || defaultCategoryId);
  const [description, setDescription] = useState(product?.description || "");
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [sortOrder, setSortOrder] = useState(product?.sort_order ?? 0);

  const [initialVariantLabel, setInitialVariantLabel] = useState("Стандарт");
  const [initialVariantPrice, setInitialVariantPrice] = useState("150");
  const [initialVariantWeight, setInitialVariantWeight] = useState("");

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (product) {
      const payload: ProductUpdatePayload = {
        name: name.trim(),
        category_id: Number(categoryId),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        sort_order: Number(sortOrder),
      };
      updateProduct.mutate(
        { productId: product.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: ProductCreatePayload = {
        name: name.trim(),
        category_id: Number(categoryId),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        sort_order: Number(sortOrder),
        is_available: true,
        variants: [
          {
            label: initialVariantLabel.trim() || "Стандарт",
            price: parseFloat(initialVariantPrice) || 0,
            weight: initialVariantWeight.trim() || null,
            sort_order: 0,
            is_available: true,
          },
        ],
      };
      createProduct.mutate(payload, {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      });
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{product ? "Редагування страви" : "Нова страва"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва страви</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Маргарита, Чізбургер..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">Категорія / Підкатегорія</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              {(() => {
                const roots = categories.filter((c) => c.parent_id === null);
                const subsByParent = new Map<number, AdminCategory[]>();
                categories
                  .filter((c) => c.parent_id !== null)
                  .forEach((c) => {
                    const list = subsByParent.get(c.parent_id!) || [];
                    list.push(c);
                    subsByParent.set(c.parent_id!, list);
                  });

                return roots.map((root) => {
                  const subs = subsByParent.get(root.id) || [];
                  if (subs.length > 0) {
                    return (
                      <optgroup
                        key={root.id}
                        label={`${root.icon ? `${root.icon} ` : ""}${root.name} (${root.location_name || ""})`}
                      >
                        {subs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {root.name} → {s.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  }
                  return (
                    <option key={root.id} value={root.id}>
                      {root.icon ? `${root.icon} ` : ""}{root.name} ({root.location_name || ""})
                    </option>
                  );
                });
              })()}
            </select>
          </label>

          <label className="block">
            <span className="opacity-60">Опис / Склад</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Склад, алергени або особливості страви..."
              className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">URL зображення</span>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">Порядок сортування</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          {!product && (
            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--app-border)" }}>
              <span className="font-bold opacity-80">Початковий варіант ціни:</span>
              <div className="grid grid-cols-3 gap-2">
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Розмір</span>
                  <input
                    value={initialVariantLabel}
                    onChange={(e) => setInitialVariantLabel(e.target.value)}
                    placeholder="30 см"
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Ціна (₴)</span>
                  <input
                    type="number"
                    value={initialVariantPrice}
                    onChange={(e) => setInitialVariantPrice(e.target.value)}
                    placeholder="180"
                    required
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Вага / Об'єм</span>
                  <input
                    value={initialVariantWeight}
                    onChange={(e) => setInitialVariantWeight(e.target.value)}
                    placeholder="450 г"
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              {product ? "Зберегти" : "Створити страву"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VariantModal({
  productId,
  variant,
  onClose,
}: {
  productId: number;
  variant: AdminVariant | null;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(variant?.label || "Порція");
  const [price, setPrice] = useState(variant ? String(variant.price) : "100");
  const [weight, setWeight] = useState(variant?.weight || "");
  const [sortOrder, setSortOrder] = useState(variant?.sort_order ?? 0);

  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !price) return;

    if (variant) {
      const payload: VariantUpdatePayload = {
        label: label.trim(),
        price: parseFloat(price) || 0,
        weight: weight.trim() || null,
        sort_order: Number(sortOrder),
      };
      updateVariant.mutate(
        { variantId: variant.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: VariantCreatePayload = {
        label: label.trim(),
        price: parseFloat(price) || 0,
        weight: weight.trim() || null,
        sort_order: Number(sortOrder),
        is_available: true,
      };
      createVariant.mutate(
        { productId, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{variant ? "Редагування розміру/ціни" : "Новий розмір/ціна"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва варіанта (напр. 30 см, 0.5 л, Велика)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="30 см"
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="opacity-60">Ціна (₴)</span>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150"
                required
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="opacity-60">Вага / Вихід (опц.)</span>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="450 г"
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>
          </div>

          <label className="block">
            <span className="opacity-60">Порядок сортування</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManagerModal({
  manager,
  locations,
  initialUser = null,
  onClose,
}: {
  manager: Manager | null;
  locations: Location[];
  initialUser?: AdminUser | null;
  onClose: () => void;
}) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(initialUser);
  const [telegramId, setTelegramId] = useState(
    manager
      ? String(manager.telegram_id)
      : initialUser
      ? String(initialUser.telegram_id)
      : "",
  );
  const [selectionMode, setSelectionMode] = useState<"client" | "manual">(
    manager ? "manual" : "client",
  );
  const [clientSearch, setClientSearch] = useState("");
  const [role, setRole] = useState<"admin" | "manager">(manager?.role || "manager");
  const [locationId, setLocationId] = useState<string>(
    manager?.location_id ? String(manager.location_id) : "",
  );

  const { data: users = [], isPending: isUsersPending } = useAdminUsers(clientSearch);
  const { data: managers = [] } = useAdminManagers();

  const createManager = useCreateManager();
  const updateManager = useUpdateManager();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLoc = locationId ? Number(locationId) : null;

    if (manager) {
      updateManager.mutate(
        {
          managerId: manager.id,
          payload: {
            role,
            location_id: parsedLoc,
          },
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const tid = parseInt(telegramId.trim(), 10);
      if (isNaN(tid)) {
        alert("Оберіть клієнта зі списку або введіть числовий Telegram ID");
        return;
      }
      createManager.mutate(
        {
          telegram_id: tid,
          role,
          location_id: parsedLoc,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
          onError: (err) => {
            alert(`Помилка: ${err.message}`);
          },
        },
      );
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!clientSearch.trim()) return users.slice(0, 10);
    const q = clientSearch.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        String(u.telegram_id).includes(q),
    ).slice(0, 15);
  }, [users, clientSearch]);

  const existingManager = useMemo(() => {
    if (!telegramId) return null;
    const tid = parseInt(telegramId, 10);
    return managers.find((m) => m.telegram_id === tid);
  }, [managers, telegramId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1c1c1e] shadow-2xl"
        style={{ border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--app-border)" }}>
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>{manager ? "✏️" : "👔"}</span>
            <span>{manager ? "Редагування співробітника" : "Призначити співробітника"}</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Якщо створюємо нового співробітника: вибір клієнта або ручне введення */}
          {!manager && (
            <div className="space-y-2">
              <div className="flex rounded-xl p-1 gap-1" style={{ background: "var(--app-surface-2)" }}>
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setSelectionMode("client");
                  }}
                  className={`flex-1 py-2 text-center rounded-lg font-semibold transition ${
                    selectionMode === "client"
                      ? "shadow-sm bg-white dark:bg-[#2c2c2e] text-[var(--tg-theme-text-color)]"
                      : "opacity-60"
                  }`}
                >
                  👥 З бази клієнтів
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setSelectionMode("manual");
                  }}
                  className={`flex-1 py-2 text-center rounded-lg font-semibold transition ${
                    selectionMode === "manual"
                      ? "shadow-sm bg-white dark:bg-[#2c2c2e] text-[var(--tg-theme-text-color)]"
                      : "opacity-60"
                  }`}
                >
                  ✏️ Ввести ID вручну
                </button>
              </div>

              {selectionMode === "client" ? (
                <div className="space-y-2">
                  {selectedUser ? (
                    <div
                      className="rounded-2xl p-3 border flex items-center justify-between"
                      style={{
                        background: "color-mix(in srgb, #10b981 10%, var(--app-surface))",
                        borderColor: "color-mix(in srgb, #10b981 40%, transparent)",
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">👤</span>
                          <span className="font-bold text-xs">{selectedUser.full_name}</span>
                          {existingManager && (
                            <span className="text-[10px] rounded px-1.5 py-0.2 font-semibold bg-amber-500/20 text-amber-500">
                              Вже в штаті
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] opacity-70">
                          📞 {selectedUser.phone} • 🆔 <span className="font-mono font-semibold">{selectedUser.telegram_id}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(null);
                          setTelegramId("");
                        }}
                        className="text-xs font-semibold text-blue-500 hover:underline px-2 py-1"
                      >
                        Змінити
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          placeholder="Пошук за ім'ям, телефоном або Telegram ID..."
                          className="w-full rounded-xl p-2.5 pr-8 text-xs outline-none focus:ring-2 focus:ring-blue-500 border border-[var(--app-border)]"
                          style={inputStyle}
                        />
                        {clientSearch && (
                          <button
                            type="button"
                            onClick={() => setClientSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-40 hover:opacity-100"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div
                        className="max-h-44 overflow-y-auto rounded-xl border border-[var(--app-border)] p-1 divide-y divide-[var(--app-border)] text-xs"
                        style={{ background: "var(--app-surface-2)" }}
                      >
                        {isUsersPending ? (
                          <div className="p-3 text-center opacity-60">Завантаження клієнтів...</div>
                        ) : filteredUsers.length === 0 ? (
                          <div className="p-3 text-center opacity-50">
                            Клієнтів не знайдено
                          </div>
                        ) : (
                          filteredUsers.map((u) => {
                            const isMgr = managers.find((m) => m.telegram_id === u.telegram_id);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setTelegramId(String(u.telegram_id));
                                }}
                                className="w-full text-left p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center justify-between gap-2"
                              >
                                <div className="truncate">
                                  <p className="font-semibold text-xs flex items-center gap-1.5 truncate">
                                    <span>{isMgr ? "👔" : "👤"}</span>
                                    <span className="truncate">{u.full_name}</span>
                                    {isMgr && (
                                      <span className="text-[9px] shrink-0 px-1 py-0.2 rounded bg-amber-500/15 text-amber-500 font-bold">
                                        В штаті
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] opacity-60 font-mono">
                                    📞 {u.phone} • 🆔 {u.telegram_id}
                                  </p>
                                </div>
                                <span className="text-xs text-blue-500 font-bold shrink-0">
                                  Обрати →
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <label className="block">
                  <span className="opacity-60">Telegram ID</span>
                  <input
                    type="number"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="123456789"
                    required
                    className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-[var(--app-border)]"
                    style={inputStyle}
                  />
                  <span className="mt-1 block text-[10px] opacity-50">
                    Користувач вже повинен відкрити бот або додаток, щоб бути в базі.
                  </span>
                </label>
              )}
            </div>
          )}

          {manager && (
            <div className="rounded-xl p-3 border border-[var(--app-border)] bg-[var(--app-surface-2)]">
              <p className="font-bold text-xs">👤 {manager.full_name}</p>
              <p className="text-[11px] opacity-70 mt-0.5">📞 {manager.phone} • 🆔 {manager.telegram_id}</p>
            </div>
          )}

          <label className="block">
            <span className="opacity-60 font-medium">Роль співробітника</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "manager")}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-[var(--app-border)]"
              style={inputStyle}
            >
              <option value="manager">Менеджер закладу</option>
              <option value="admin">Головний адміністратор</option>
            </select>
          </label>

          <label className="block">
            <span className="opacity-60 font-medium">Заклад (прив'язка)</span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-[var(--app-border)]"
              style={inputStyle}
            >
              <option value="">Без прив'язки (всі заклади)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70 border border-[var(--app-border)]"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={createManager.isPending || updateManager.isPending}
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              {createManager.isPending || updateManager.isPending ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 5. ВКЛАДКА НАЛАШТУВАННЯ ДОСТАВКИ ТА НАВАНТАЖЕННЯ
// ============================================================================

interface DeliverySettingsTabProps {
  locationId?: number | null;
  isSuperAdmin: boolean;
}

function DeliverySettingsTab({ locationId }: DeliverySettingsTabProps) {
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

