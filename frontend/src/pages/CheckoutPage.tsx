import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useCart, useCreateOrder, useLocations, useMe } from "@/api/queries";
import { ErrorBox, ScreenTitle, Spinner, formatPrice } from "@/components/ui";
import { WebHeader } from "@/components/WebHeader";
import {
  CheckoutOrderSummary,
  ContactSection,
  DeliveryAddressSection,
  FulfillmentSelector,
  PaymentMethodSelector,
  TimeSelector,
  type AddressSource,
} from "@/components/checkout";
import { useBackButton } from "@/hooks/useBackButton";
import { isTelegramWebApp } from "@/telegram/env";
import { haptic, hapticNotify } from "@/telegram/sdk";
import { RegisterPage } from "@/pages/RegisterPage";

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const locationIdParam = searchParams.get("locationId");
  const targetLocationId = locationIdParam ? parseInt(locationIdParam, 10) : null;

  useBackButton(() => navigate("/cart"));

  const { data: cart, isPending: isCartPending } = useCart();
  const { data: locations, isPending: isLocationsPending } = useLocations();
  const { data: user, isPending: isUserPending, refetch } = useMe();
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

  // Розрахунок дат та часу для замовлення
  const { todayStr, tomorrowStr, min30TimeStr } = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tom = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const min30Date = new Date(now.getTime() + 30 * 60 * 1000);
    const min30 = `${String(min30Date.getHours()).padStart(2, "0")}:${String(min30Date.getMinutes()).padStart(2, "0")}`;
    return { todayStr: today, tomorrowStr: tom, min30TimeStr: min30 };
  }, []);

  const [scheduledDate, setScheduledDate] = useState<string>(todayStr);

  const locStartTime = targetLocation?.delivery_start_time || "10:30";
  const locEndTime = targetLocation?.delivery_end_time || "21:30";

  const effectiveMinTime = useMemo(() => {
    return scheduledDate === todayStr
      ? min30TimeStr > locStartTime
        ? min30TimeStr
        : locStartTime
      : locStartTime;
  }, [scheduledDate, todayStr, min30TimeStr, locStartTime]);

  const isTodayClosedForScheduled = scheduledDate === todayStr && effectiveMinTime > locEndTime;

  const [addressSource, setAddressSource] = useState<AddressSource>(() => {
    if (user?.delivery_address) return "main";
    if (user?.additional_address) return "additional";
    return "custom";
  });
  const [customAddressStr, setCustomAddressStr] = useState("");
  const [isCustomAddressValid, setIsCustomAddressValid] = useState(false);
  const [courierNote, setCourierNote] = useState("");

  const [userAddressesLoaded, setUserAddressesLoaded] = useState(false);
  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "qr">("cash");
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (!userAddressesLoaded) {
        setUserAddressesLoaded(true);
        if (user.delivery_address) {
          setAddressSource("main");
        } else if (user.additional_address) {
          setAddressSource("additional");
        } else {
          setAddressSource("custom");
        }
      }
      setContactName((prev) => (prev.trim() ? prev : (user.full_name ?? "")));
      setContactPhone((prev) => (prev.trim() ? prev : (user.phone ?? "")));
    }
  }, [user, userAddressesLoaded]);

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

  if (isTelegramWebApp() && !user) {
    return (
      <RegisterPage
        onRegistered={(newUser) => {
          if (newUser) {
            setContactName(newUser.full_name || "");
            setContactPhone(newUser.phone || "");
            if (newUser.delivery_address) {
              setAddressSource("main");
            }
          }
          void refetch();
        }}
      />
    );
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
      if (scheduledDate < todayStr) {
        setSubmitError("Дата замовлення не може бути в минулому");
        hapticNotify("error");
        return;
      }
      if (scheduledDate === todayStr) {
        if (scheduledTime < min30TimeStr) {
          setSubmitError(
            `Час замовлення не може бути меншим ніж поточний час + 30 хв (найраніший доступний час: ${min30TimeStr})`,
          );
          hapticNotify("error");
          return;
        }
      }
      if (scheduledTime < locStartTime || scheduledTime > locEndTime) {
        const actionLabel = fulfillmentType === "delivery" ? "доставки" : "самовивозу";
        setSubmitError(`Час ${actionLabel} має бути в межах робочих годин (${locStartTime} – ${locEndTime})`);
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
        scheduled_time:
          timeMode === "scheduled" && scheduledTime
            ? scheduledDate === todayStr
              ? scheduledTime
              : `${scheduledDate} ${scheduledTime}`
            : null,
        comment: comment.trim() || null,
        items: locationItems.map((item) => ({
          variant_id: item.variant_id ?? 0,
          qty: item.qty,
          option_variant_ids: item.options.flatMap((o) => Array(o.qty).fill(o.variant_id)),
        })),
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
      {isTelegramWebApp() && (
        <ScreenTitle
          onBack={() => {
            haptic("light");
            navigate("/cart");
          }}
        >
          Оформлення
        </ScreenTitle>
      )}

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
        <FulfillmentSelector
          fulfillmentType={fulfillmentType}
          onChange={setFulfillmentType}
          isDeliveryEnabled={isDeliveryEnabled}
        />

        {/* Час отримання */}
        <TimeSelector
          fulfillmentType={fulfillmentType}
          timeMode={timeMode}
          onTimeModeChange={setTimeMode}
          scheduledDate={scheduledDate}
          onScheduledDateChange={setScheduledDate}
          scheduledTime={scheduledTime}
          onScheduledTimeChange={setScheduledTime}
          todayStr={todayStr}
          tomorrowStr={tomorrowStr}
          locStartTime={locStartTime}
          locEndTime={locEndTime}
          effectiveMinTime={effectiveMinTime}
          isTodayClosedForScheduled={isTodayClosedForScheduled}
        />

        {/* Адреса доставки або деталі самовивозу */}
        <DeliveryAddressSection
          fulfillmentType={fulfillmentType}
          targetLocationAddress={targetLocation?.address}
          addressSource={addressSource}
          onAddressSourceChange={setAddressSource}
          userDeliveryAddress={user?.delivery_address}
          userAdditionalAddress={user?.additional_address}
          onCustomAddressChange={(full, valid) => {
            setCustomAddressStr(full);
            setIsCustomAddressValid(valid);
          }}
          courierNote={courierNote}
          onCourierNoteChange={setCourierNote}
          onNavigateProfile={() => navigate("/profile")}
        />

        {/* Контакти отримувача */}
        <ContactSection
          contactName={contactName}
          onContactNameChange={setContactName}
          contactPhone={contactPhone}
          onContactPhoneChange={setContactPhone}
        />

        {/* Спосіб оплати */}
        <PaymentMethodSelector
          paymentMethod={paymentMethod}
          onChange={setPaymentMethod}
          showQr={showQr}
          fulfillmentType={fulfillmentType}
        />

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
        <CheckoutOrderSummary items={locationItems} subtotal={subtotal} />

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
