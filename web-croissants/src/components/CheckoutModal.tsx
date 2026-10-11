import { useEffect, useState } from "react";
import { CROISSANTS_LOCATION_ID, fetchDeliveryAddresses, submitWebOrder } from "../api/client.ts";
import { useCart } from "../context/CartContext.tsx";
import type { DeliveryAddress } from "../types/catalog.ts";
import type { OrderOut, WebOrderCreatePayload, WebOrderItemPayload } from "../types/order.ts";
import { formatPhoneNumber, isValidUkrainianPhone, normalizeE164Phone } from "../utils/phone.ts";
import { getWorkingHoursInfo } from "../utils/workingHours.ts";
import { LAST_ORDER_STORAGE_KEY, ORDERS_HISTORY_STORAGE_KEY } from "./OrderTrackingModal.tsx";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: OrderOut) => void;
}

const CUSTOMER_STORAGE_KEY = "doma_customer_details_v1";

interface SavedCustomer {
  name: string;
  phone: string;
  street: string;
  house: string;
  apartment: string;
}

export function CheckoutModal({ isOpen, onClose, onSuccess }: CheckoutModalProps) {
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

  // Завантаження збережених контактів та адресного довідника
  useEffect(() => {
    if (isOpen) {
      fetchDeliveryAddresses("Вишгород")
        .then(setStreetsList)
        .catch(() => setStreetsList([]));

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
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatPhoneNumber(raw);
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

    const payload: WebOrderCreatePayload = {
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
        const updated = Array.from(new Set([createdOrder.id, ...(Array.isArray(savedHist) ? savedHist : [])])).slice(0, 10);
        localStorage.setItem(ORDERS_HISTORY_STORAGE_KEY, JSON.stringify(updated));
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
        {/* Хедер модалки — завжди зафіксований зверху і ніколи не заїжджає за екран */}
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

        {/* Форма зі скролабельним тілом та закріпленим футером */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 overscroll-contain">
          {/* Інформація про графік роботи */}
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

          {/* Підказка автозаповнення */}
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

          {/* Перемикач: Доставка / Самовивіз */}
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

          {/* Поля адреси (якщо доставка) */}
          {fulfillmentType === "delivery" ? (
            <div className="space-y-3 p-4 rounded-2xl bg-[#FAF7F2] border border-[#EADFCF]">
              <div>
                <label className="block text-xs font-bold text-[#6B533E] mb-1">
                  Вулиця (м. Вишгород) *
                </label>
                <input
                  type="text"
                  required
                  list="streets-datalist"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Введіть або оберіть вулицю..."
                  className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
                />
                <datalist id="streets-datalist">
                  {streetsList.map((s) => (
                    <option key={s.id} value={s.street} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#6B533E] mb-1">
                    Будинок *
                  </label>
                  <input
                    type="text"
                    required
                    value={house}
                    onChange={(e) => setHouse(e.target.value)}
                    placeholder="Напр. 15, 2Д"
                    className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B533E] mb-1">
                    Квартира / Офіс
                  </label>
                  <input
                    type="text"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="Опціонально"
                    className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
                  />
                </div>
              </div>
              <div className="text-[11px] text-[#7A695C] bg-white rounded-xl p-2.5 border border-[#EADFCF] flex items-center justify-between">
                <span>🛵 Доставка по Вишгороду щодня: 10:00 – 20:00</span>
                <span className="font-bold text-[#C8823E]">від 250 ₴ безкоштовно</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#FFF9EE] border border-[#E8C288] text-xs sm:text-sm text-[#7A4B1A] flex items-start gap-3">
              <span className="text-xl">📍</span>
              <div>
                <span className="font-bold">Адреса для самовивозу:</span>
                <div>м. Вишгород, просп. Шевченка, 2Д (Doma Croissants)</div>
                <div className="text-[11px] text-[#A66C31] mt-0.5">
                  Пекарня відчинена з 08:00 до 20:00. Приготуємо свіжим до вашого приходу!
                </div>
              </div>
            </div>
          )}

          {/* Контактні дані */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#6B533E] mb-1">
                Ваше ім'я *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Як до вас звертатися?"
                className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6B533E] mb-1">
                Номер телефону *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={handlePhoneChange}
                placeholder="+380 (XX) XXX-XX-XX"
                className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
              />
            </div>
          </div>

          {/* Чекбокс запам'ятати мої дані */}
          <label className="flex items-center gap-2.5 text-xs text-[#6B533E] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveDetails}
              onChange={(e) => setSaveDetails(e.target.checked)}
              className="accent-[#C8823E] w-4 h-4 rounded"
            />
            <span>Запам'ятати мої контактні дані для наступних замовлень</span>
          </label>

          {/* Час отримання */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#7A695C]">
              Час отримання
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#2C1E14] cursor-pointer">
                <input
                  type="radio"
                  name="time_type"
                  checked={isAsap}
                  onChange={() => setIsAsap(true)}
                  className="accent-[#C8823E]"
                />
                <span>Якнайшвидше (від 30 хв)</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-[#2C1E14] cursor-pointer">
                <input
                  type="radio"
                  name="time_type"
                  checked={!isAsap}
                  onChange={() => setIsAsap(false)}
                  className="accent-[#C8823E]"
                />
                <span>На певний час</span>
              </label>
            </div>
            {!isAsap && (
              <input
                type="text"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                placeholder="Наприклад: 14:30 або на завтра 09:00"
                className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
              />
            )}
          </div>

          {/* Спосіб оплати */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#7A695C]">
              Спосіб оплати
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`p-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  paymentMethod === "cash"
                    ? "border-[#C8823E] bg-[#FFF8EE] text-[#2C1E14] ring-2 ring-[#C8823E]/20"
                    : "border-[#EADFCF] bg-white text-[#6B533E]"
                }`}
              >
                <span>💵</span>
                <span>Готівка</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`p-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  paymentMethod === "card"
                    ? "border-[#C8823E] bg-[#FFF8EE] text-[#2C1E14] ring-2 ring-[#C8823E]/20"
                    : "border-[#EADFCF] bg-white text-[#6B533E]"
                }`}
              >
                <span>💳</span>
                <span>Карткою при отриманні</span>
              </button>
            </div>
          </div>

          {/* Коментар */}
          <div>
            <label className="block text-xs font-bold text-[#6B533E] mb-1">
              Коментар до замовлення
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Побажання щодо пакування, код домофону тощо..."
              className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
            />
          </div>

          </div>

          {/* Підсумок і кнопка відправки — закріплені внизу */}
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
