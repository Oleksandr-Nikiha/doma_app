import { haptic } from "@/telegram/sdk";

interface PaymentMethodSelectorProps {
  paymentMethod: "cash" | "card" | "qr";
  onChange: (val: "cash" | "card" | "qr") => void;
  showQr: boolean;
  fulfillmentType: "delivery" | "pickup";
}

export function PaymentMethodSelector({
  paymentMethod,
  onChange,
  showQr,
  fulfillmentType,
}: PaymentMethodSelectorProps) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
        Спосіб оплати
      </label>
      <div className={`grid ${showQr ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
        <button
          type="button"
          onClick={() => {
            haptic("light");
            onChange("cash");
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
            onChange("card");
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
              onChange("qr");
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
  );
}

