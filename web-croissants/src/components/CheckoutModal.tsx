import { useEffect, useState } from "react";
import { authTelegramWidget, CROISSANTS_LOCATION_ID, fetchDeliveryAddresses, submitWebOrder } from "../api/client.ts";
import { useCart } from "../context/CartContext.tsx";
import type { DeliveryAddress } from "../types/catalog.ts";
import type { OrderOut, WebOrderCreatePayload, WebOrderItemPayload } from "../types/order.ts";
import { formatPhoneOnInput, handlePhoneKeyDown, formatPhoneNumber, isValidUkrainianPhone, normalizeE164Phone } from "../utils/phone.ts";
import { getWorkingHoursInfo } from "../utils/workingHours.ts";
import { AddressFields } from "./checkout/AddressFields.tsx";
import { CustomerInfoFields } from "./checkout/CustomerInfoFields.tsx";
import { PhoneAuthView } from "./cabinet/PhoneAuthView.tsx";
import { LAST_ORDER_STORAGE_KEY, ORDERS_HISTORY_STORAGE_KEY } from "./OrderTrackingModal.tsx";
import { isUserAuthenticated, USER_PROFILE_STORAGE_KEY, type UserProfile } from "../types/user.ts";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: OrderOut) => void;
  isAuthenticated?: boolean;
  userProfile?: UserProfile | null;
  onRequireAuth?: () => void;
  onAuthSuccess?: (profile: UserProfile) => void;
}

export const CUSTOMER_STORAGE_KEY = "doma_customer_details_v1";

export interface SavedCustomer {
  name: string;
  phone: string;
  street: string;
  house: string;
  apartment: string;
}

export function CheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  isAuthenticated = false,
  userProfile,
  onAuthSuccess,
}: CheckoutModalProps) {
  const { items, totalPrice, clearCart } = useCart();

  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [apartment, setApartment] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isAsap, setIsAsap] = useState(true);
  const [comment, setComment] = useState("");
  const [saveDetails, setSaveDetails] = useState(true);
  const [isAutofilled, setIsAutofilled] = useState(false);

  const [streetsList, setStreetsList] = useState<DeliveryAddress[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursInfo = getWorkingHoursInfo();

  // Завантаження збережених контактів та адресного довідника для авторизованого користувача
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchDeliveryAddresses("Вишгород")
        .then(setStreetsList)
        .catch(() => setStreetsList([]));

      // Пріоритет: дані авторизованого профілю
      if (userProfile && isUserAuthenticated(userProfile)) {
        let loadedAny = false;
        if (userProfile.name && !name) {
          setName(userProfile.name);
          loadedAny = true;
        }
        if (userProfile.phone && !phone) {
          setPhone(formatPhoneNumber(userProfile.phone));
          loadedAny = true;
        }
        if (userProfile.street && !street) {
          setStreet(userProfile.street);
          loadedAny = true;
        }
        if (userProfile.house && !house) {
          setHouse(userProfile.house);
          loadedAny = true;
        }
        if (userProfile.apartment && !apartment) {
          setApartment(userProfile.apartment);
          loadedAny = true;
        }
        if (loadedAny) {
          setIsAutofilled(true);
        }
        return;
      }

      try {
        const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);
        if (saved) {
          const data: SavedCustomer = JSON.parse(saved);
          let loadedAny = false;
          if (data.name && !name) {
            setName(data.name);
            loadedAny = true;
          }
          if (data.phone && !phone) {
            setPhone(formatPhoneNumber(data.phone));
            loadedAny = true;
          }
          if (data.street && !street) {
            setStreet(data.street);
            loadedAny = true;
          }
          if (data.house && !house) {
            setHouse(data.house);
            loadedAny = true;
          }
          if (data.apartment && !apartment) {
            setApartment(data.apartment);
            loadedAny = true;
          }
          if (loadedAny) {
            setIsAutofilled(true);
          }
        }
      } catch (err) {
        console.error("Помилка читання збережених даних", err);
      }
    }
  }, [isOpen, isAuthenticated, userProfile]);

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
        <div className="fixed inset-0" onClick={onClose} />
        <div className="relative bg-[#FAF7F2] rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#E8DFC8] z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
          <div className="shrink-0 p-4 sm:p-5 border-b border-[#EADFCF] flex items-center justify-between bg-white shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFF8EE] border border-[#EADFCF] flex items-center justify-center text-lg shrink-0">
                🛍️
              </div>
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#2C1E14]">
                  Авторизація для замовлення
                </h2>
                <p className="text-xs text-[#7A695C] mt-0.5">
                  Doma Croissants • м. Вишгород
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-9 h-9 rounded-full bg-[#FAF7F2] hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs active:scale-95"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
            <PhoneAuthView
              authReason="checkout"
              onSuccess={(userOut) => {
                const newProf: UserProfile = {
                  name: userOut.full_name,
                  first_name: userOut.first_name || undefined,
                  last_name: userOut.last_name || undefined,
                  phone: userOut.phone,
                  street: userOut.delivery_address || "",
                  house: "",
                  apartment: "",
                  telegram_id: userOut.telegram_id,
                  bonuses: Math.max(50, userOut.bonus_balance || 0),
                  client_code: userOut.client_code,
                  is_phone_verified: userOut.is_phone_verified,
                  isAuthenticated: true,
                };
                try {
                  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(newProf));
                } catch {}
                if (onAuthSuccess) {
                  onAuthSuccess(newProf);
                }
              }}
              onTelegramAuth={async (tgUser) => {
                try {
                  const userOut = await authTelegramWidget(tgUser);
                  const newProf: UserProfile = {
                    name: userOut.full_name || tgUser.first_name || "",
                    first_name: tgUser.first_name || undefined,
                    last_name: tgUser.last_name || undefined,
                    phone: userOut.phone,
                    street: userOut.delivery_address || "",
                    house: "",
                    apartment: "",
                    telegram_id: userOut.telegram_id,
                    username: tgUser.username,
                    avatar_url: tgUser.photo_url,
                    bonuses: Math.max(50, userOut.bonus_balance || 0),
                    client_code: userOut.client_code,
                    is_phone_verified: true,
                    isAuthenticated: true,
                  };
                  try {
                    localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(newProf));
                  } catch {}
                  if (onAuthSuccess) {
                    onAuthSuccess(newProf);
                  }
                } catch (err) {
                  console.error("Помилка авторизації Telegram:", err);
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneOnInput(e.target.value, phone);
    setPhone(formatted);
  };

  const handleClearSavedData = () => {
    try {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch {}
    setName("");
    setPhone("");
    setStreet("");
    setHouse("");
    setApartment("");
    setIsAutofilled(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAuthenticated) {
      setError("Для оформлення замовлення необхідно авторизуватися.");
      return;
    }

    if (!name.trim()) {
      setError("Будь ласка, вкажіть ваше ім'я");
      return;
    }

    if (!isValidUkrainianPhone(phone)) {
      setError("Вкажіть коректний контактний номер телефону (наприклад: +380 93 112 77 33)");
      return;
    }

    const cleanPhone = normalizeE164Phone(phone);

    let fullAddress: string | null = null;
    if (fulfillmentType === "delivery") {
      if (!street.trim()) {
        setError("Оберіть або вкажіть вулицю для доставки");
        return;
      }
      if (!house.trim()) {
        setError("Вкажіть номер будинку");
        return;
      }
      fullAddress = `м. Вишгород, ${street.trim()}, буд. ${house.trim()}${
        apartment.trim() ? `, кв./офіс ${apartment.trim()}` : ""
      }`;
    }

    const orderItems: WebOrderItemPayload[] = items.map((i) => ({
      variant_id: i.variant.id,
      qty: i.qty,
      option_variant_ids: i.selectedOptions.map((o) => o.option.variant_id),
    }));

    let tgId: number | null = null;
    try {
      const savedProf = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      if (savedProf) {
        const parsed = JSON.parse(savedProf);
        if (parsed.telegram_id) tgId = Number(parsed.telegram_id);
      }
    } catch {}

    const payload: WebOrderCreatePayload = {
      telegram_id: tgId,
      location_id: CROISSANTS_LOCATION_ID,
      fulfillment_type: fulfillmentType,
      delivery_address: fullAddress,
      contact_name: name.trim(),
      contact_phone: cleanPhone,
      payment_method: paymentMethod,
      scheduled_time: isAsap ? null : scheduledTime.trim() || null,
      comment: comment.trim() || null,
      source: "web_croissants",
      items: orderItems,
    };

    setSubmitting(true);
    try {
      const createdOrder = await submitWebOrder(payload);

      // Збереження даних клієнта для швидких наступних замовлень
      if (saveDetails) {
        try {
          const toSave: SavedCustomer = {
            name: name.trim(),
            phone: cleanPhone,
            street: street.trim(),
            house: house.trim(),
            apartment: apartment.trim(),
          };
          localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(toSave));
        } catch (saveErr) {
          console.error("Не вдалося зберегти дані клієнта у localStorage", saveErr);
        }
      }

      clearCart();
      try {
        localStorage.setItem(LAST_ORDER_STORAGE_KEY, String(createdOrder.id));
        const savedHist = JSON.parse(
          localStorage.getItem(ORDERS_HISTORY_STORAGE_KEY) || "[]",
        );
        const updated = Array.from(
          new Set([createdOrder.id, ...(Array.isArray(savedHist) ? savedHist : [])]),
        ).slice(0, 10);
        localStorage.setItem(ORDERS_HISTORY_STORAGE_KEY, JSON.stringify(updated));

        // Оновлюємо профіль користувача в localStorage
        const prevProfStr = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
        const prevProf = prevProfStr ? JSON.parse(prevProfStr) : {};
        const updatedProf = {
          ...prevProf,
          name: name.trim(),
          phone: cleanPhone,
          street: street.trim(),
          house: house.trim(),
          apartment: apartment.trim(),
          telegram_id: createdOrder.telegram_id || prevProf.telegram_id || null,
          bonuses: prevProf.bonuses || 50,
          client_code: prevProf.client_code || `DM-${createdOrder.telegram_id || createdOrder.id}`,
          is_phone_verified: Boolean(createdOrder.telegram_id || prevProf.is_phone_verified),
        };
        localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(updatedProf));

        // Сповіщаємо інші компоненти (кабінет, відстеження) про нове замовлення
        window.dispatchEvent(new CustomEvent("doma:order_created", { detail: createdOrder }));
      } catch {}
      onSuccess(createdOrder);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Помилка при оформленні замовлення";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#E8DFC8] animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        {/* Хедер модалки */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-[#EADFCF] flex items-center justify-between bg-[#FAF7F2]">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2C1E14]">
              Оформлення замовлення
            </h2>
            <p className="text-[11px] sm:text-xs text-[#7A695C] mt-0.5">
              Doma Croissants • Вишгород, просп. Шевченка, 2Д
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-full bg-white hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 overscroll-contain">
            {hoursInfo.checkoutNotice && (
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
                <span className="text-lg shrink-0">🌙</span>
                <div className="leading-relaxed font-medium">
                  {hoursInfo.checkoutNotice}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {isAutofilled && (
              <div className="flex items-center justify-between bg-[#F8F4EC] border border-[#E5DAC8] px-3.5 py-2 rounded-xl text-xs text-[#6B533E]">
                <span className="flex items-center gap-1.5">
                  <span>✨</span>
                  <span>Ваші дані автозаповнено для швидкого замовлення</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearSavedData}
                  className="text-[#9C5B23] hover:underline font-semibold text-[11px] cursor-pointer"
                >
                  Очистити
                </button>
              </div>
            )}

            {/* Спосіб отримання */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7A695C]">
                Спосіб отримання
              </label>
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-[#F3EDE2] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFulfillmentType("delivery")}
                  className={`py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    fulfillmentType === "delivery"
                      ? "bg-[#2C1E14] text-white shadow-sm"
                      : "text-[#6B533E] hover:text-[#2C1E14]"
                  }`}
                >
                  <span>🛵</span>
                  <span>Доставка</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType("pickup")}
                  className={`py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    fulfillmentType === "pickup"
                      ? "bg-[#2C1E14] text-white shadow-sm"
                      : "text-[#6B533E] hover:text-[#2C1E14]"
                  }`}
                >
                  <span>🛍️</span>
                  <span>Самовивіз</span>
                </button>
              </div>
            </div>

            {/* Адресні поля */}
            <AddressFields
              fulfillmentType={fulfillmentType}
              street={street}
              setStreet={setStreet}
              house={house}
              setHouse={setHouse}
              apartment={apartment}
              setApartment={setApartment}
              streetsList={streetsList}
            />

            {/* Контактні дані та параметри */}
            <CustomerInfoFields
              name={name}
              setName={setName}
              phone={phone}
              onPhoneChange={handlePhoneChange}
              onPhoneKeyDown={handlePhoneKeyDown}
              saveDetails={saveDetails}
              setSaveDetails={setSaveDetails}
              isAsap={isAsap}
              setIsAsap={setIsAsap}
              scheduledTime={scheduledTime}
              setScheduledTime={setScheduledTime}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              comment={comment}
              setComment={setComment}
              isPhoneVerified={Boolean(userProfile?.is_phone_verified)}
            />
          </div>

          {/* Підсумок і кнопка відправки */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-[#EADFCF] bg-[#FAF7F2] flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-[#7A695C]">Разом до сплати:</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#2C1E14]">
                {totalPrice} ₴
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex-1 max-w-xs bg-[#2C1E14] hover:bg-[#3D2C1F] disabled:opacity-50 text-white py-3 sm:py-3.5 px-5 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-[#2C1E14]/15 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Оформлення...</span>
                </>
              ) : (
                <span>Підтвердити замовлення</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
