import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useCart, useCreateOrder, useLocations, useMe } from "@/api/queries";
import { ErrorBox, ScreenTitle, Spinner, formatPrice } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
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

  // Фільтруємо позиції для обраного закладу
  const locationItems = useMemo(() => {
    if (!cart?.items) return [];
    if (!targetLocationId) return cart.items;
    return cart.items.filter((item) => item.location_id === targetLocationId);
  }, [cart, targetLocationId]);

  const targetLocation = useMemo(() => {
    if (!locations || !targetLocationId) return null;
    return locations.find((l) => l.id === targetLocationId) ?? null;
  }, [locations, targetLocationId]);

  const subtotal = useMemo(() => {
    return locationItems.reduce((sum, item) => sum + item.subtotal, 0);
  }, [locationItems]);

  // Стан форми
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [streetAddress, setStreetAddress] = useState(user?.delivery_address ?? "");
  const [additionalAddress, setAdditionalAddress] = useState(user?.additional_address ?? "");
  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isCartPending || isLocationsPending || isUserPending) {
    return <Spinner />;
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
      const street = streetAddress.trim();
      const extra = additionalAddress.trim();
      if (!street) {
        setSubmitError("Вкажіть вулицю та номер будинку");
        hapticNotify("error");
        return;
      }
      fullDeliveryAddress = extra ? `${street}, ${extra}` : street;
    }

    haptic("medium");

    createOrder.mutate(
      {
        fulfillment_type: fulfillmentType,
        location_id: targetLocationId,
        delivery_address: fullDeliveryAddress,
        contact_name: name,
        contact_phone: phone,
        payment_method: paymentMethod,
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
    <div className="pb-8">
      <ScreenTitle>Оформлення</ScreenTitle>

      <form onSubmit={handleSubmit} className="app-rise space-y-5 px-4">
        {/* Картка закладу */}
        {targetLocation && (
          <div className="app-card rounded-2xl p-3.5">
            <p className="text-xs font-medium uppercase tracking-wider opacity-50">Заклад</p>
            <p className="mt-0.5 font-semibold text-base">📍 {targetLocation.name}</p>
            <p className="mt-0.5 text-xs opacity-70">{targetLocation.address}</p>
          </div>
        )}

        {/* Спосіб отримання */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
            Спосіб отримання
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setFulfillmentType("delivery");
              }}
              className={`app-press rounded-xl p-3 text-center text-sm font-semibold transition ${
                fulfillmentType === "delivery"
                  ? "shadow-sm ring-2 ring-current"
                  : "opacity-60"
              }`}
              style={{
                background: fulfillmentType === "delivery" ? "var(--app-tint)" : "var(--app-surface-2)",
                color: fulfillmentType === "delivery" ? "var(--tg-theme-link-color)" : "inherit",
              }}
            >
              🛵 Доставка
            </button>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setFulfillmentType("pickup");
              }}
              className={`app-press rounded-xl p-3 text-center text-sm font-semibold transition ${
                fulfillmentType === "pickup"
                  ? "shadow-sm ring-2 ring-current"
                  : "opacity-60"
              }`}
              style={{
                background: fulfillmentType === "pickup" ? "var(--app-tint)" : "var(--app-surface-2)",
                color: fulfillmentType === "pickup" ? "var(--tg-theme-link-color)" : "inherit",
              }}
            >
              🛍️ Самовивіз
            </button>
          </div>
        </div>

        {/* Адреса доставки або деталі самовивозу */}
        {fulfillmentType === "delivery" ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium opacity-70">Вулиця, будинок *</label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="наприклад: вул. Набережна, 4, під'їзд 2"
                required
                className="w-full rounded-xl p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium opacity-70">
                Квартира, поверх, домофон (необов'язково)
              </label>
              <input
                type="text"
                value={additionalAddress}
                onChange={(e) => setAdditionalAddress(e.target.value)}
                placeholder="кв. 42, поверх 5, код 1234"
                className="w-full rounded-xl p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setPaymentMethod("cash");
              }}
              className={`app-press rounded-xl p-3 text-center text-sm font-semibold transition ${
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
              className={`app-press rounded-xl p-3 text-center text-sm font-semibold transition ${
                paymentMethod === "card"
                  ? "shadow-sm ring-2 ring-current"
                  : "opacity-60"
              }`}
              style={{
                background: paymentMethod === "card" ? "var(--app-tint)" : "var(--app-surface-2)",
                color: paymentMethod === "card" ? "var(--tg-theme-link-color)" : "inherit",
              }}
            >
              💳 Картка
            </button>
          </div>
          <p className="mt-1.5 text-[11px] opacity-50 text-center">
            {fulfillmentType === "delivery"
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

