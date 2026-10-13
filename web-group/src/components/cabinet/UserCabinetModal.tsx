import { useEffect, useState } from "react";
import {
  authTelegramWidget,
  fetchDeliveryAddresses,
  fetchWebOrdersHistory,
  fetchWebProfile,
  updateWebProfile,
} from "../../api/client.ts";
import { useModalBehavior } from "../../hooks/useModalBehavior.ts";
import type { DeliveryAddress } from "../../types/catalog.ts";
import type { OrderOut } from "../../types/order.ts";
import { isUserAuthenticated, USER_PROFILE_STORAGE_KEY, type UserProfile } from "../../types/user.ts";
import { UserAvatar } from "../ui/UserAvatar.tsx";
import { LoyaltyBonusTab } from "./LoyaltyBonusTab.tsx";
import { OrdersHistoryTab } from "./OrdersHistoryTab.tsx";
import { PhoneAuthView } from "./PhoneAuthView.tsx";
import { ProfileSettingsTab } from "./ProfileSettingsTab.tsx";
import type { TelegramUser } from "./TelegramLoginWidget.tsx";

const CUSTOMER_STORAGE_KEY = "doma_customer_info_v1";
const ORDERS_HISTORY_STORAGE_KEY = "doma_orders_history_ids_v1";

interface UserCabinetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
  isAuthenticated?: boolean;
  authReason?: "cabinet" | "checkout" | null;
  onAuthSuccess?: (profile: UserProfile) => void;
}

export function UserCabinetModal({
  isOpen,
  onClose,
  onProfileUpdated,
  isAuthenticated = false,
  authReason = null,
  onAuthSuccess,
}: UserCabinetModalProps) {
  useModalBehavior({ isOpen, onClose });

  const [currentView, setCurrentView] = useState<"profile" | "orders" | "auth" | "loyalty">("auth");
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    phone: "",
    street: "",
    house: "",
    apartment: "",
    bonuses: 0,
    isAuthenticated: false,
  });
  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [streetsList, setStreetsList] = useState<DeliveryAddress[]>([]);

  // Синхронізація вкладки з авторизацією
  useEffect(() => {
    if (isOpen) {
      if (!isAuthenticated) {
        setCurrentView("auth");
      } else {
        setCurrentView("profile");
      }
    }
  }, [isOpen, isAuthenticated]);

  // Завантаження профілю з пам'яті при відкритті
  useEffect(() => {
    if (!isOpen) return;

    if (isAuthenticated) {
      fetchDeliveryAddresses("Вишгород")
        .then(setStreetsList)
        .catch(() => setStreetsList([]));
    }

    try {
      const savedProf = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      let currentProfile: UserProfile = {
        name: "",
        phone: "",
        street: "",
        house: "",
        apartment: "",
        bonuses: 0,
        isAuthenticated: false,
      };

      if (savedProf) {
        const parsed: UserProfile = JSON.parse(savedProf);
        if (isUserAuthenticated(parsed)) {
          const isVerified = Boolean(parsed.is_phone_verified || parsed.telegram_id);
          currentProfile = {
            ...currentProfile,
            ...parsed,
            is_phone_verified: isVerified,
            bonuses: parsed.bonuses ?? 50,
            isAuthenticated: true,
          };
          setProfile(currentProfile);

          // Синхронізуємо актуальні дані з сервера
          if (currentProfile.telegram_id || currentProfile.phone) {
            void fetchWebProfile({
              telegram_id: currentProfile.telegram_id,
              phone: currentProfile.phone,
            }).then((serverUser) => {
              if (serverUser) {
                setProfile((prev) => {
                  const merged: UserProfile = {
                    ...prev,
                    name: serverUser.full_name || prev.name,
                    first_name: serverUser.first_name || prev.first_name,
                    last_name: serverUser.last_name || prev.last_name,
                    phone: serverUser.phone || prev.phone,
                    telegram_id: serverUser.telegram_id || prev.telegram_id,
                    is_phone_verified:
                      serverUser.is_phone_verified ||
                      Boolean(serverUser.telegram_id) ||
                      Boolean(prev.telegram_id),
                    street: prev.street || serverUser.delivery_address || "",
                    additional_address: prev.additional_address || serverUser.additional_address || "",
                    client_code: serverUser.client_code || prev.client_code,
                  };
                  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(merged));
                  if (onProfileUpdated) onProfileUpdated(merged);
                  return merged;
                });
              }
            });
          }
        }
      }

      if (currentProfile.phone || currentProfile.telegram_id) {
        void loadOrders(currentProfile.phone, currentProfile.telegram_id, false);
      }
    } catch {}
  }, [isOpen, isAuthenticated]);

  // Завантаження замовлень
  const loadOrders = async (
    phoneParam?: string,
    tgParam?: number | null,
    showSpinner = true,
  ) => {
    const p = phoneParam !== undefined ? phoneParam : profile.phone;
    const t = tgParam !== undefined ? tgParam : profile.telegram_id;
    if (!p && !t) return;

    if (showSpinner) setLoadingOrders(true);
    try {
      let localIds: number[] = [];
      try {
        localIds = JSON.parse(
          localStorage.getItem(ORDERS_HISTORY_STORAGE_KEY) || "[]",
        );
      } catch {}

      const res = await fetchWebOrdersHistory({
        phone: p || undefined,
        telegram_id: t || undefined,
        local_order_ids: localIds,
      });

      setOrders(res);
    } catch (err) {
      console.error("Не вдалося завантажити історію замовлень:", err);
    } finally {
      if (showSpinner) setLoadingOrders(false);
    }
  };

  const handleSaveProfile = (updated: UserProfile) => {
    const merged: UserProfile = {
      ...profile,
      ...updated,
      isAuthenticated: true,
    };
    setProfile(merged);
    try {
      localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(merged));
      const cust = {
        name: merged.name,
        phone: merged.phone,
        street: merged.street,
        house: merged.house,
        apartment: merged.apartment,
      };
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(cust));
    } catch {}

    if (onProfileUpdated) {
      onProfileUpdated(merged);
    }

    if (merged.telegram_id || merged.phone) {
      void updateWebProfile({
        telegram_id: merged.telegram_id,
        phone: merged.phone,
        first_name: merged.first_name,
        last_name: merged.last_name,
        delivery_address: merged.street
          ? `${merged.street}, буд. ${merged.house}${merged.apartment ? `, кв. ${merged.apartment}` : ""}`
          : undefined,
        additional_address: merged.additional_address || undefined,
      }).catch((err) => console.error("Помилка збереження профілю на сервері:", err));
    }
  };

  const handleTelegramAuth = async (tgUser: TelegramUser) => {
    try {
      const serverUser = await authTelegramWidget(tgUser);

      const updatedProfile: UserProfile = {
        ...profile,
        name: serverUser.full_name || `${tgUser.first_name} ${tgUser.last_name || ""}`.trim(),
        first_name: serverUser.first_name || tgUser.first_name,
        last_name: serverUser.last_name || tgUser.last_name,
        phone: serverUser.phone || profile.phone,
        telegram_id: serverUser.telegram_id || tgUser.id,
        username: tgUser.username,
        avatar_url: tgUser.photo_url,
        bonuses: Math.max(profile.bonuses, serverUser.bonus_balance || 50),
        client_code: serverUser.client_code || `DM-${tgUser.id}`,
        is_phone_verified: true,
        isAuthenticated: true,
      };

      if (serverUser.delivery_address && !profile.street) {
        updatedProfile.street = serverUser.delivery_address;
      }
      if (serverUser.additional_address && !profile.additional_address) {
        updatedProfile.additional_address = serverUser.additional_address;
      }

      handleSaveProfile(updatedProfile);

      if (onAuthSuccess) {
        onAuthSuccess(updatedProfile);
      } else {
        setCurrentView("profile");
        void loadOrders(updatedProfile.phone, updatedProfile.telegram_id, false);
      }
    } catch (err) {
      console.error("Помилка авторизації Telegram віджета:", err);
    }
  };

  const handleDisconnectTelegram = () => {
    const updated: UserProfile = {
      ...profile,
      telegram_id: null,
      username: null,
      avatar_url: null,
      is_phone_verified: false,
    };
    handleSaveProfile(updated);
    void loadOrders(updated.phone, null, false);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch {}
    const empty: UserProfile = {
      name: "",
      phone: "",
      street: "",
      house: "",
      apartment: "",
      bonuses: 0,
      is_phone_verified: false,
      isAuthenticated: false,
      telegram_id: null,
      username: null,
      avatar_url: null,
    };
    setProfile(empty);
    setOrders([]);
    setCurrentView("auth");
    if (onProfileUpdated) {
      onProfileUpdated(empty);
    }
  };

  const handleRepeatOrder = (order: OrderOut) => {
    const hasPizzaOrSushi = order.groups.some((g) =>
      g.items.some(
        (i) =>
          i.product_name.toLowerCase().includes("піца") ||
          i.product_name.toLowerCase().includes("рол") ||
          i.product_name.toLowerCase().includes("сет") ||
          i.product_name.toLowerCase().includes("бургер"),
      ),
    );
    window.location.href = hasPizzaOrSushi ? "/pizza/" : "/croissant/";
  };

  if (!isOpen) return null;

  const ordersCount = orders.length;
  const activeOrdersCount = orders.filter(
    (o) =>
      o.status !== "completed" &&
      o.status !== "rejected" &&
      o.status !== "cancelled",
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#FAF7F2] rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#E8DFC8] z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        {/* Хедер модалки */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-[#EADFCF] flex items-center justify-between bg-white shadow-2xs">
          <div className="flex items-center gap-3">
            {isAuthenticated && currentView !== "profile" ? (
              <button
                type="button"
                onClick={() => setCurrentView("profile")}
                className="w-9 h-9 rounded-full bg-[#FAF7F2] hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] flex items-center justify-center font-bold text-sm cursor-pointer shadow-2xs active:scale-95 transition-all"
                title="Назад до профілю"
              >
                ←
              </button>
            ) : isAuthenticated ? (
              <UserAvatar
                avatarUrl={profile.avatar_url}
                name={profile.name || profile.username}
                size="md"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#FFF8EE] border border-[#EADFCF] flex items-center justify-center text-lg shrink-0">
                🎁
              </div>
            )}
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#2C1E14]">
                {!isAuthenticated
                  ? "Вхід до DomaClub"
                  : currentView === "orders"
                  ? "Мої замовлення"
                  : currentView === "loyalty"
                  ? "Програма лояльності"
                  : currentView === "auth"
                  ? "Авторизація"
                  : profile.name
                  ? `Вітаємо, ${profile.name.split(" ")[0]}!`
                  : "Кабінет DomaClub"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-[#7A695C]">
                  {!isAuthenticated
                    ? "Увійдіть для перегляду бонусів та замовлень"
                    : profile.phone ? profile.phone : "Учасник клубу DOMA"}
                </p>
                {isAuthenticated && profile.telegram_id && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold px-2 py-0.2 rounded-full">
                    Telegram ✓
                  </span>
                )}
                {isAuthenticated && (profile.is_phone_verified || Boolean(profile.telegram_id)) && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2 py-0.2 rounded-full">
                    Верифіковано ✓
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            aria-label="Закрити"
            className="w-9 h-9 rounded-full bg-[#FAF7F2] hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs active:scale-95 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Тіло модального вікна */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
          {!isAuthenticated || currentView === "auth" ? (
            <PhoneAuthView
              authReason={authReason}
              onTelegramAuth={handleTelegramAuth}
              onCancel={isAuthenticated ? () => setCurrentView("profile") : undefined}
            />
          ) : currentView === "orders" ? (
            <OrdersHistoryTab
              orders={orders}
              loading={loadingOrders}
              onRepeatOrder={handleRepeatOrder}
              onOpenTracking={(id) => {
                window.location.href = `/pizza/#track-${id}`;
              }}
              onRefresh={() => void loadOrders(profile.phone, profile.telegram_id, false)}
            />
          ) : currentView === "loyalty" ? (
            <LoyaltyBonusTab
              bonuses={profile.bonuses ?? 50}
              phone={profile.phone}
            />
          ) : (
            <ProfileSettingsTab
              profile={profile}
              ordersCount={ordersCount}
              activeOrdersCount={activeOrdersCount}
              streetsList={streetsList}
              onOpenOrders={() => setCurrentView("orders")}
              onOpenLoyalty={() => setCurrentView("loyalty")}
              onSaveProfile={handleSaveProfile}
              onLogout={handleLogout}
              onOpenPhoneAuth={() => setCurrentView("auth")}
              onTelegramAuth={handleTelegramAuth}
              onDisconnectTelegram={handleDisconnectTelegram}
            />
          )}
        </div>

        {/* Футер */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-[#EADFCF] bg-white flex items-center justify-between">
          <div className="text-[11px] text-[#8D7B6D]">
            {currentView === "orders" ? (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Історія замовлень по всій мережі
              </span>
            ) : (
              <span>DomaGroup Inc. • Мережа смаку та гостинності</span>
            )}
          </div>

          <button
            onClick={onClose}
            type="button"
            className="bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-2 px-6 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
