import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useCart, useCreateOrder, useLocations, useMe } from "@/api/queries";
import { ErrorBox, ScreenTitle, SegmentedControl, Spinner, formatPrice } from "@/components/ui";
import { WebHeader } from "@/components/WebHeader";
import { AddressSelector } from "@/components/delivery/AddressSelector";
import { useBackButton } from "@/hooks/useBackButton";
import { isTelegramWebApp } from "@/telegram/env";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const locationIdParam = searchParams.get("locationId");
  const targetLocationId = locationIdParam ? parseInt(locationIdParam, 10) : null;

  useBackButton(() => navigate("/cart"));

  const { data: cart, isPending: isCartPending } = useCart();
  const { data: locations, isPending: isLocationsPending } = useLocations();
  const { data: user, isPending: isUserPending } = useMe();
  const createOrder = useCreateOrder();

  // Перевірка кількості закладів у кошику
  const distinctLocationIds = useMemo(() => {
    if (!cart?.items) return [];
    return Array.from(new Set(cart.items.map((item) => item.location_id)));
  }, [cart]);

  // Фільтруємо позиції для обраного закладу
  const locationItems = useMemo(() => {
    if (!cart?.items) return [];
    if (!targetLocationId) return cart.items;
    return cart.items.filter((item) => item.location_id === targetLocationId);
  }, [cart, targetLocationId]);

  const targetLocation = useMemo(() => {
    if (!locations || !targetLocationId) {
      if (locations && distinctLocationIds.length === 1) {
        return locations.find((l) => l.id === distinctLocationIds[0]) ?? null;
      }
      return null;
    }
    return locations.find((l) => l.id === targetLocationId) ?? null;
  }, [locations, targetLocationId, distinctLocationIds]);

  const subtotal = useMemo(() => {
    return locationItems.reduce((sum, item) => sum + item.subtotal, 0);
  }, [locationItems]);

  const isDeliveryEnabled = targetLocation ? targetLocation.is_delivery_enabled !== false : true;
  const isPizza = targetLocation ? targetLocation.name.toLowerCase().includes("pizza") : false;

  // Стан форми
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [timeMode, setTimeMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  type AddressSource = "main" | "additional" | "custom";
  const [addressSource, setAddressSource] = useState<AddressSource>(() => {
    if (user?.delivery_address) return "main";
    if (user?.additional_address) return "additional";
    return "custom";
  });
  const [customAddressStr, setCustomAddressStr] = useState("");
  const [isCustomAddressValid, setIsCustomAddressValid] = useState(false);
  const [courierNote, setCourierNote] = useState("");

  const [userAddressesLoaded, setUserAddressesLoaded] = useState(false);
  useEffect(() => {
    if (user && !userAddressesLoaded) {
      setUserAddressesLoaded(true);
      if (user.delivery_address) {
        setAddressSource("main");
      } else if (user.additional_address) {
        setAddressSource("additional");
      } else {
        setAddressSource("custom");
      }
    }
  }, [user, userAddressesLoaded]);
  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "qr">("cash");
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Якщо доставка тимчасово вимкнена через навантаження — перемикаємо на самовивіз
  useEffect(() => {
    if (!isDeliveryEnabled && fulfillmentType === "delivery") {
      setFulfillmentType("pickup");
    }
  }, [isDeliveryEnabled, fulfillmentType]);

  // Чи показувати опцію оплати по QR-коду (тільки для піцерії при доставці)
  const showQr = isPizza && fulfillmentType === "delivery";

  // Якщо QR недоступний, скидаємо на "cash"
  useEffect(() => {
    if (!showQr && paymentMethod === "qr") {
      setPaymentMethod("cash");
    }
  }, [showQr, paymentMethod]);

  if (isCartPending || isLocationsPending || isUserPending) {
    return <Spinner />;
  }

  // Якщо в кошику страви з різних закладів, а користувач зайшов без конкретного locationId
  if (distinctLocationIds.length > 1 && !targetLocationId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl">🛵</div>
        <p className="mt-3 font-semibold">Окреме замовлення для кожного закладу</p>
        <p className="mt-2 text-xs opacity-70 max-w-[280px]">
          У вашому кошику є страви з кількох закладів. Доставка для кожного закладу здійснюється окремо. Будь ласка, оберіть заклад у кошику.
        </p>
        <button
          onClick={() => navigate("/cart")}
          className="app-press mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Повернутися до кошика
        </button>
      </div>
    );
  }

  if (!locationItems.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl">🛒</div>
        <p className="mt-3 font-semibold">Немає страв для оформлення</p>
        <p className="mt-1 text-sm opacity-60">У цьому закладі немає вибраних страв у кошику.</p>
        <button
          onClick={() => navigate("/cart")}
          className="app-press mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Повернутися до кошика
        </button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createOrder.isPending) return;
    setSubmitError(null);

    const name = contactName.trim();
    const phone = contactPhone.trim();

    if (!name) {
      setSubmitError("Вкажіть ім'я отримувача");
      hapticNotify("error");
      return;
    }

    if (!phone || phone.length < 9) {
      setSubmitError("Вкажіть коректний номер телефону");
      hapticNotify("error");
      return;
    }

    let fullDeliveryAddress: string | null = null;
    if (fulfillmentType === "delivery") {
      if (!isDeliveryEnabled) {
        setSubmitError("Доставка з цього закладу наразі недоступна через навантаження");
        hapticNotify("error");
        return;
      }

      let baseAddress = "";
      if (addressSource === "main") {
        if (!user?.delivery_address?.trim()) {
          setSubmitError("У вашому профілі не вказано основну адресу. Оберіть 'Інша' або збережіть адресу в профілі.");
          hapticNotify("error");
          return;
        }
        baseAddress = user.delivery_address.trim();
      } else if (addressSource === "additional") {
        if (!user?.additional_address?.trim()) {
          setSubmitError("У вашому профілі не вказано додаткову адресу. Оберіть 'Інша' або збережіть адресу в профілі.");
          hapticNotify("error");
          return;
        }
        baseAddress = user.additional_address.trim();
      } else {
        if (!isCustomAddressValid || !customAddressStr.trim()) {
          setSubmitError("Оберіть вулицю з довідника та обов'язково вкажіть номер будинку");
          hapticNotify("error");
          return;
        }
        baseAddress = customAddressStr.trim();
      }

      const extra = courierNote.trim();
      fullDeliveryAddress = extra ? `${baseAddress}, ${extra}` : baseAddress;
    }

    if (timeMode === "scheduled") {
      if (!scheduledTime) {
        setSubmitError("Вкажіть бажаний час отримання замовлення");
        hapticNotify("error");
        return;
      }
      const startTime = targetLocation?.delivery_start_time || "10:30";
      const endTime = targetLocation?.delivery_end_time || "21:30";
      if (scheduledTime < startTime || scheduledTime > endTime) {
        setSubmitError(`Час отримання має бути в межах ${startTime} – ${endTime}`);
        hapticNotify("error");
        return;
      }
    }

    haptic("medium");

    createOrder.mutate(
      {
        fulfillment_type: fulfillmentType,
        location_id: targetLocation?.id ?? targetLocationId,
        delivery_address: fullDeliveryAddress,
        contact_name: name,
        contact_phone: phone,
        payment_method: paymentMethod,
        scheduled_time: timeMode === "scheduled" && scheduledTime ? scheduledTime : null,
        comment: comment.trim() || null,
      },
      {
        onSuccess: (order) => {
          hapticNotify("success");
          navigate(`/orders/${order.id}/success`, { replace: true });
        },
        onError: (err) => {
          hapticNotify("error");
          setSubmitError(
            err instanceof ApiError ? err.detail : "Не вдалося оформити замовлення. Спробуйте ще раз.",
          );
        },
      },
    );
  };

  const busy = createOrder.isPending;

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg pb-8 bg-[var(--tg-theme-bg-color)]">
      <WebHeader title="Оформлення" showBack onBack={() => navigate("/cart")} />
      {isTelegramWebApp() && <ScreenTitle>Оформлення</ScreenTitle>}

      <form onSubmit={handleSubmit} className="app-rise space-y-5 px-4">
        {/* Картка закладу */}
        {targetLocation && (
          <div className="app-card rounded-2xl p-3.5">
            <p className="text-xs font-medium uppercase tracking-wider opacity-50">Заклад</p>
            <p className="mt-0.5 font-semibold text-base">📍 {targetLocation.name}</p>
            <p className="mt-0.5 text-xs opacity-70">{targetLocation.address}</p>
            <p className="mt-1.5 text-[11px] opacity-60">
              Години доставки: {targetLocation.delivery_start_time} – {targetLocation.delivery_end_time}
            </p>
          </div>
        )}

        {/* Спосіб отримання */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
            Спосіб отримання
          </label>
          <SegmentedControl
            value={fulfillmentType}
            onChange={(val) => {
              haptic("light");
              setFulfillmentType(val);
            }}
            options={[
              { value: "delivery", label: "Доставка", icon: "🛵", disabled: !isDeliveryEnabled },
              { value: "pickup", label: "Самовивіз", icon: "🛍️" },
            ]}
          />

          {/* Попередження про високе навантаження */}
          {!isDeliveryEnabled && (
            <div
              className="mt-2.5 rounded-xl p-3 text-xs leading-relaxed flex items-start gap-2 border"
              style={{
                background: "color-mix(in srgb, #ef4444 10%, transparent)",
                color: "#ef4444",
                borderColor: "color-mix(in srgb, #ef4444 30%, transparent)",
              }}
            >
              <span className="text-sm">⚠️</span>
              <div>
                <p className="font-semibold">Доставка тимчасово вимкнена</p>
                <p className="mt-0.5 opacity-90">
                  Через високе навантаження кухні та кур'єрів заклад наразі приймає замовлення лише на <b>самовивіз</b>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Час отримання: Якнайшвидше або На певний час */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
            Час {fulfillmentType === "delivery" ? "доставки" : "самовивозу"}
          </label>
          <SegmentedControl
            value={timeMode}
            onChange={(val) => {
              haptic("light");
              setTimeMode(val);
            }}
            options={[
              { value: "asap", label: "Якнайшвидше", icon: "⚡" },
              { value: "scheduled", label: "На певний час", icon: "⏰" },
            ]}
          />

          {timeMode === "scheduled" && (
            <div className="mt-2.5 space-y-1.5">
              <label className="block text-[11px] opacity-70">
                Введіть або оберіть бажаний час (години доставки: {targetLocation?.delivery_start_time || "10:30"} – {targetLocation?.delivery_end_time || "21:30"}):
              </label>
              <input
                type="time"
                value={scheduledTime}
                min={targetLocation?.delivery_start_time || "10:30"}
                max={targetLocation?.delivery_end_time || "21:30"}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="w-full max-w-xs rounded-xl border border-[var(--app-border)] p-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-blue-500"
                style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
              />
              <p className="text-[11px] opacity-50">
                Доставка можлива з {targetLocation?.delivery_start_time || "10:30"} до {targetLocation?.delivery_end_time || "21:30"}.
              </p>
            </div>
          )}
        </div>

        {/* Адреса доставки або деталі самовивозу */}
        {fulfillmentType === "delivery" ? (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
                Адреса доставки
              </label>
              <SegmentedControl
                value={addressSource}
                onChange={(val) => {
                  haptic("light");
                  setAddressSource(val);
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
                {user?.delivery_address ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium opacity-60">📍 Основна адреса</span>
                      <button
                        type="button"
                        onClick={() => navigate("/profile")}
                        className="text-xs font-semibold text-[var(--tg-theme-button-color)] hover:underline"
                      >
                        Змінити в профілі
                      </button>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{user.delivery_address}</p>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs opacity-70">Основна адреса не вказана у вашому профілі</p>
                    <div className="mt-2.5 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate("/profile")}
                        className="rounded-xl px-3 py-1.5 text-xs font-medium bg-[var(--app-surface)] border border-[var(--app-border)]"
                      >
                        Вказати в профілі
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddressSource("custom")}
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
                {user?.additional_address ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium opacity-60">🏢 Додаткова адреса</span>
                      <button
                        type="button"
                        onClick={() => navigate("/profile")}
                        className="text-xs font-semibold text-[var(--tg-theme-button-color)] hover:underline"
                      >
                        Змінити в профілі
                      </button>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{user.additional_address}</p>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs opacity-70">Додаткова адреса не вказана у вашому профілі</p>
                    <div className="mt-2.5 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate("/profile")}
                        className="rounded-xl px-3 py-1.5 text-xs font-medium bg-[var(--app-surface)] border border-[var(--app-border)]"
                      >
                        Вказати в профілі
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddressSource("custom")}
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
              <AddressSelector
                onChange={(full, valid) => {
                  setCustomAddressStr(full);
                  setIsCustomAddressValid(valid);
                }}
              />
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
                Під'їзд, код домофону або примітка кур'єру (необов'язково)
              </label>
              <input
                type="text"
                value={courierNote}
                onChange={(e) => setCourierNote(e.target.value)}
                placeholder="під'їзд 2, поверх 4, код 1234, заїзд з боку двору"
                className="w-full rounded-xl border border-[var(--app-border)] p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-3.5 text-xs leading-relaxed" style={{ background: "var(--app-surface-2)" }}>
            <p className="font-semibold">Адреса для самовивозу:</p>
            <p className="mt-1 opacity-80">{targetLocation?.address || "м. Вишгород"}</p>
            <p className="mt-2 opacity-60">
              Ми повідомимо вас у чаті з ботом, щойно замовлення буде готове до видачі.
            </p>
          </div>
        )}

        {/* Контакти отримувача */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">
            Контакти одержувача
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium opacity-70">Ім'я *</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ваше ім'я"
              required
              className="w-full rounded-xl p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--app-surface-2)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium opacity-70">Телефон *</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+380..."
              required
              className="w-full rounded-xl p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--app-surface-2)" }}
            />
          </div>
        </div>

        {/* Спосіб оплати */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
            Спосіб оплати
          </label>
          <div className={`grid ${showQr ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setPaymentMethod("cash");
              }}
              className={`app-press rounded-xl p-3 text-center text-xs font-semibold transition ${
                paymentMethod === "cash"
                  ? "shadow-sm ring-2 ring-current"
                  : "opacity-60"
              }`}
              style={{
                background: paymentMethod === "cash" ? "var(--app-tint)" : "var(--app-surface-2)",
                color: paymentMethod === "cash" ? "var(--tg-theme-link-color)" : "inherit",
              }}
            >
              💵 Готівка
            </button>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setPaymentMethod("card");
              }}
              className={`app-press rounded-xl p-3 text-center text-xs font-semibold transition ${
                paymentMethod === "card"
                  ? "shadow-sm ring-2 ring-current"
                  : "opacity-60"
              }`}
              style={{
                background: paymentMethod === "card" ? "var(--app-tint)" : "var(--app-surface-2)",
                color: paymentMethod === "card" ? "var(--tg-theme-link-color)" : "inherit",
              }}
            >
              💳 Термінал
            </button>
            {showQr && (
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  setPaymentMethod("qr");
                }}
                className={`app-press rounded-xl p-3 text-center text-xs font-semibold transition ${
                  paymentMethod === "qr"
                    ? "shadow-sm ring-2 ring-current"
                    : "opacity-60"
                }`}
                style={{
                  background: paymentMethod === "qr" ? "var(--app-tint)" : "var(--app-surface-2)",
                  color: paymentMethod === "qr" ? "var(--tg-theme-link-color)" : "inherit",
                }}
              >
                📱 QR-код
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] opacity-60 text-center leading-relaxed">
            {paymentMethod === "qr"
              ? "Оплата смартфоном за спеціальним QR-кодом, надрукованим у чеку (при доставці)"
              : fulfillmentType === "delivery"
                ? paymentMethod === "cash"
                  ? "Оплата готівкою кур'єру при отриманні"
                  : "Оплата карткою через термінал у кур'єра"
                : paymentMethod === "cash"
                  ? "Оплата готівкою при отриманні у закладі"
                  : "Оплата карткою на касі закладу"}
          </p>
        </div>

        {/* Коментар */}
        <div>
          <label className="mb-1 block text-xs font-medium opacity-70">
            Коментар до замовлення (необов'язково)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Побажання щодо доставки або приготування..."
            rows={2}
            className="w-full resize-none rounded-xl p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
            style={{ background: "var(--app-surface-2)" }}
          />
        </div>

        {/* Склад замовлення */}
        <div className="app-card rounded-2xl p-3.5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-60">Склад замовлення</p>
          {locationItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0" style={{ borderColor: "var(--app-border)" }}>
              <div className="min-w-0 pr-2">
                <p className="font-medium truncate">{item.product_name}</p>
                <p className="text-[11px] opacity-60">
                  {item.variant_label} × {item.qty}
                  {item.options.length > 0 && ` (${item.options.map((o) => o.name).join(", ")})`}
                </p>
              </div>
              <span className="font-semibold shrink-0">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 text-base font-bold">
            <span>Разом</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
        </div>

        {submitError && <ErrorBox message={submitError} />}

        {/* Кнопка підтвердження */}
        <button
          type="submit"
          disabled={busy}
          className="app-press w-full rounded-xl py-3.5 font-bold shadow-md transition disabled:opacity-50"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
          }}
        >
          {busy ? "Оформлюємо..." : `Замовити — ${formatPrice(subtotal)}`}
        </button>
      </form>
    </div>
  );
}
