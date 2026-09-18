import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCancelOrder, useCart, useOrder, useRepeatOrder } from "@/api/queries";
import { ErrorBox, ScreenTitle, Spinner, formatPrice } from "@/components/ui";
import { WebHeader } from "@/components/WebHeader";
import { useBackButton } from "@/hooks/useBackButton";
import { isTelegramWebApp } from "@/telegram/env";
import { haptic, hapticNotify } from "@/telegram/sdk";

const getSteps = (fulfillmentType?: string) => [
  { key: "pending_moderation", label: "Прийнято", icon: "📝" },
  { key: "confirmed", label: "Підтверджено", icon: "👍" },
  { key: "in_progress", label: "Готується", icon: "👨‍🍳" },
  {
    key: "ready",
    label: fulfillmentType === "delivery" ? "В дорозі" : "Готово",
    icon: fulfillmentType === "delivery" ? "🛵" : "🛍️",
  },
  { key: "completed", label: "Виконано", icon: "🎉" },
];

function getStepIndex(status: string) {
  switch (status) {
    case "pending_moderation":
    case "pending":
      return 0;
    case "confirmed":
      return 1;
    case "in_progress":
      return 2;
    case "ready":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

export function OrderSuccessPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const id = orderId ? parseInt(orderId, 10) : 0;

  useBackButton(() => navigate("/"));

  const { data: order, isPending, error, refetch } = useOrder(id);
  const { data: cart } = useCart();
  const cancelOrder = useCancelOrder();
  const repeatOrder = useRepeatOrder();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  const handleRepeatOrder = () => {
    haptic("medium");
    repeatOrder.mutate(
      { orderId: id },
      {
        onSuccess: (res) => {
          hapticNotify("success");
          if (res.unavailable_items && res.unavailable_items.length > 0) {
            alert(
              `Товари додано до кошика за актуальними цінами!\n\nЗверніть увагу: деякі позиції наразі недоступні в меню:\n• ${res.unavailable_items.join("\n• ")}`
            );
          } else if (res.price_changed) {
            alert(
              `Товари додано до кошика за актуальними цінами!\nНова сума: ${formatPrice(res.new_total)} (було: ${formatPrice(res.old_total)})`
            );
          }
          navigate("/cart");
        },
        onError: (err) => {
          hapticNotify("error");
          alert(err instanceof Error ? err.message : "Не вдалося повторити замовлення");
        },
      }
    );
  };

  useEffect(() => {
    if (!order) return;
    if (prevStatusRef.current && prevStatusRef.current !== order.status) {
      if (
        order.status === "confirmed" ||
        order.status === "ready" ||
        order.status === "completed"
      ) {
        hapticNotify("success");
      } else if (order.status === "rejected" || order.status === "cancelled") {
        hapticNotify("error");
      } else {
        haptic("medium");
      }
    }
    prevStatusRef.current = order.status;
  }, [order?.status]);

  if (isPending) return <Spinner />;
  if (error || !order) {
    return (
      <div className="p-4">
        <ErrorBox message={error?.message || "Замовлення не знайдено"} onRetry={() => void refetch()} />
      </div>
    );
  }

  const statusBadge = () => {
    switch (order.status) {
      case "confirmed":
        return {
          text: "Підтверджено",
          subtitle: "Замовлення підтверджено! Ми вже розпочали приготування 🍕✨",
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
        };
      case "in_progress":
        return {
          text: "Готується на кухні",
          subtitle: "Ваші страви просто зараз готуються кухарями! 👨‍🍳",
          color: "#3b82f6",
          bg: "rgba(59, 130, 246, 0.12)",
        };
      case "ready":
        return {
          text: order.fulfillment_type === "delivery" ? "Кур'єр у дорозі" : "Готове до видачі",
          subtitle:
            order.fulfillment_type === "delivery"
              ? "Кур'єр уже прямує до вас із вашим гарячим замовленням! 🛵💨"
              : "Ваше замовлення вже чекає на вас у закладі! 🛍️✨",
          color: "#8b5cf6",
          bg: "rgba(139, 92, 246, 0.12)",
        };
      case "completed":
        return {
          text: "Виконано",
          subtitle: "Смачного! Дякуємо, що обираєте Doma.",
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
        };
      case "rejected":
        return {
          text: "Відхилено",
          subtitle: "На жаль, замовлення відхилено. Менеджер закладу зателефонує для уточнення деталей.",
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.12)",
        };
      case "cancelled":
        return {
          text: "Скасовано",
          subtitle: "Замовлення було скасовано. Якщо у вас виникли запитання, зверніться до закладу.",
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.12)",
        };
      case "pending_moderation":
      default:
        return {
          text: "Очікує підтвердження",
          subtitle: "Менеджер закладу перевіряє ваше замовлення. Це триває лише кілька хвилин.",
          color: "#eab308",
          bg: "rgba(234, 179, 8, 0.12)",
        };
    }
  };

  const badge = statusBadge();
  const steps = getSteps(order.fulfillment_type);
  const currentStep = getStepIndex(order.status);
  const isNegative = order.status === "rejected" || order.status === "cancelled";

  const getStatusEmoji = () => {
    if (order.status === "rejected") return "😔";
    if (order.status === "cancelled") return "🚫";
    if (order.status === "completed") return "🎉";
    if (order.status === "ready") return order.fulfillment_type === "delivery" ? "🛵" : "🛍️";
    if (order.status === "in_progress") return "👨‍🍳";
    if (order.status === "confirmed") return "👍";
    return "🍕";
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg pb-8 bg-[var(--tg-theme-bg-color)]">
      <WebHeader title="Статус замовлення" showBack onBack={() => navigate("/")} />
      {isTelegramWebApp() && <ScreenTitle>Статус замовлення</ScreenTitle>}

      <div className="app-rise space-y-4 px-4">
        {/* Головна картка статусу */}
        <div className="app-card rounded-2xl p-5 text-center transition-all">
          <div className="text-5xl">
            {getStatusEmoji()}
          </div>
          <h2 className="mt-3 text-lg font-bold">
            Замовлення #{order.id}
          </h2>
          <p className="mt-1 text-xs opacity-75 leading-relaxed max-w-[280px] mx-auto">
            {badge.subtitle}
          </p>

          <div
            className="mt-3.5 inline-block rounded-full px-3.5 py-1 text-xs font-bold"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.text}
          </div>

          {/* Інтерактивний степер кроків (якщо не відхилено/скасовано) */}
          {!isNegative && (
            <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
              <div className="flex items-center justify-between relative px-2">
                {/* Лінія зв'язку */}
                <div
                  className="absolute left-6 right-6 top-3 h-0.5 -z-0 overflow-hidden"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      background: "var(--tg-theme-button-color)",
                      width: `${(currentStep / (steps.length - 1)) * 100}%`,
                    }}
                  />
                </div>

                {steps.map((step, idx) => {
                  const isDone = idx < currentStep;
                  const isActive = idx === currentStep;
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-1.5 z-10">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          isActive ? "ring-4 ring-blue-500/20 app-pop" : ""
                        }`}
                        style={{
                          background:
                            isDone || isActive
                              ? "var(--tg-theme-button-color)"
                              : "var(--app-surface-2)",
                          color:
                            isDone || isActive
                              ? "var(--tg-theme-button-text-color)"
                              : "var(--tg-theme-hint-color)",
                        }}
                      >
                        {isDone ? "✓" : idx + 1}
                      </div>
                      <span
                        className="text-[10px] font-semibold transition-opacity text-center leading-tight max-w-[56px]"
                        style={{
                          opacity: isActive ? 1 : isDone ? 0.8 : 0.4,
                          color: isActive ? "var(--tg-theme-button-color)" : "inherit",
                        }}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Кнопка скасування для клієнта (поки очікує підтвердження) */}
          {order.status === "pending_moderation" && (
            <div
              className="mt-5 pt-3.5 border-t flex flex-col items-center gap-1.5"
              style={{ borderColor: "var(--app-border)" }}
            >
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  setShowCancelModal(true);
                }}
                disabled={cancelOrder.isPending}
                className="app-press rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5"
                style={{
                  color: "#ef4444",
                  background: "color-mix(in srgb, #ef4444 10%, transparent)",
                }}
              >
                <span>🚫</span>
                <span>{cancelOrder.isPending ? "Скасування..." : "Скасувати замовлення"}</span>
              </button>
              <p className="text-[10px] opacity-50">
                Ви можете скасувати замовлення, поки заклад його не підтвердив
              </p>
            </div>
          )}
        </div>

        {/* Деталі замовлення (Чек) */}
        <div className="app-card rounded-2xl p-4 space-y-2.5 text-xs">
          <p className="font-bold text-[13px] pb-1 border-b" style={{ borderColor: "var(--app-border)" }}>
            Деталі чека
          </p>

          <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--app-border)" }}>
            <span className="opacity-60">Заклад</span>
            <span className="font-semibold">{order.groups[0]?.location_name || "Doma"}</span>
          </div>
          <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--app-border)" }}>
            <span className="opacity-60">Спосіб</span>
            <span className="font-semibold">
              {order.fulfillment_type === "delivery" ? "🛵 Доставка кур'єром" : "🛍️ Самовивіз"}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--app-border)" }}>
            <span className="opacity-60">Час</span>
            <span className="font-semibold">
              {order.scheduled_time ? `⏰ На ${order.scheduled_time}` : "⚡ Якнайшвидше"}
            </span>
          </div>
          {order.fulfillment_type === "delivery" && order.delivery_address && (
            <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--app-border)" }}>
              <span className="opacity-60">Адреса</span>
              <span className="font-semibold text-right max-w-[65%]">{order.delivery_address}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--app-border)" }}>
            <span className="opacity-60">Отримувач</span>
            <span className="font-semibold">{order.contact_name} ({order.contact_phone})</span>
          </div>
          <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--app-border)" }}>
            <span className="opacity-60">Оплата</span>
            <span className="font-semibold">
              {order.payment_method === "cash"
                ? "💵 Готівка"
                : order.payment_method === "card"
                  ? "💳 Термінал (картка)"
                  : order.payment_method === "qr"
                    ? "📱 QR-код у чеку"
                    : order.payment_method}
            </span>
          </div>
          {order.comment && (
            <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--app-border)" }}>
              <span className="opacity-60">Коментар</span>
              <span className="italic max-w-[65%] text-right opacity-80">{order.comment}</span>
            </div>
          )}

          {/* Список страв */}
          <div className="pt-2 space-y-1.5">
            <p className="font-bold opacity-60 uppercase text-[10px] tracking-wider">Страви у замовленні:</p>
            {order.groups.flatMap((g) => g.items).map((item) => (
              <div key={item.id} className="flex justify-between text-xs py-1">
                <div className="truncate pr-2">
                  <span className="font-medium">• {item.product_name}</span>
                  <span className="opacity-60"> ({item.variant_label}) × {item.qty}</span>
                  {item.options.length > 0 && (
                    <span className="opacity-60 block pl-2 text-[11px]">
                      ↳ {item.options.map((o) => o.option_name).join(", ")}
                    </span>
                  )}
                </div>
                <span className="font-bold shrink-0">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-3 text-sm font-extrabold border-t" style={{ borderColor: "var(--app-border)" }}>
            <span>Разом до сплати</span>
            <span className="text-base text-[var(--tg-theme-button-color)]">{formatPrice(order.total_price)}</span>
          </div>
        </div>

        {/* Підказка щодо оформлення замовлення з іншого закладу */}
        {cart?.items && cart.items.length > 0 && (
          <div
            className="app-card rounded-2xl p-4 space-y-2.5 border"
            style={{
              background: "var(--app-tint)",
              borderColor: "color-mix(in srgb, var(--tg-theme-button-color) 35%, transparent)",
            }}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: "var(--tg-theme-button-color)" }}>
              <span>🛵</span>
              <span>У кошику ще залишилися страви з іншого закладу</span>
            </div>
            <p className="text-xs leading-relaxed opacity-85">
              Нагадуємо: кожен заклад готує та доставляє замовлення окремим кур'єром.
            </p>
            <button
              onClick={() => {
                haptic("light");
                navigate("/cart");
              }}
              className="app-press w-full rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
              style={{
                background: "var(--tg-theme-button-color)",
                color: "var(--tg-theme-button-text-color)",
              }}
            >
              Перейти до кошика ({cart.items.length} {cart.items.length === 1 ? "страва" : "страви"}) →
            </button>
          </div>
        )}

        {/* Сповіщення в Telegram */}
        <div
          className="rounded-2xl p-3.5 text-xs leading-relaxed"
          style={{ background: "var(--app-surface-2)" }}
        >
          <p className="font-semibold flex items-center gap-1.5">
            <span>💬</span>
            <span>Сповіщення в Telegram</span>
          </p>
          <p className="mt-1 opacity-75">
            Статус замовлення синхронізується автоматично. Ви також отримаєте push-сповіщення у чаті з ботом.
          </p>
        </div>

        {/* Кнопка повторити замовлення */}
        <button
          type="button"
          onClick={handleRepeatOrder}
          disabled={repeatOrder.isPending}
          className="app-press w-full rounded-xl py-3.5 font-bold transition flex items-center justify-center gap-2 border"
          style={{
            borderColor: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-color)",
            background: "transparent",
          }}
        >
          <span>🔁</span>
          <span>{repeatOrder.isPending ? "Додаємо до кошика..." : "Повторити це замовлення"}</span>
        </button>

        {/* Кнопка на головну */}
        <button
          onClick={() => {
            haptic("light");
            navigate("/");
          }}
          className="app-press w-full rounded-xl py-3.5 font-bold shadow-md transition"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
          }}
        >
          Повернутися до меню
        </button>
      </div>

      {/* Модальне вікно підтвердження скасування */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm app-fade">
          <div
            className="w-full max-w-xs rounded-2xl p-5 shadow-2xl text-center space-y-4"
            style={{
              background: "var(--tg-theme-bg-color, #ffffff)",
              color: "var(--tg-theme-text-color, #000000)",
            }}
          >
            <div className="text-4xl">⚠️</div>
            <div>
              <h3 className="text-base font-bold">Скасувати замовлення?</h3>
              <p className="mt-1 text-xs opacity-70 leading-relaxed">
                Ви дійсно бажаєте скасувати замовлення #{order.id}? Цю дію неможливо відмінити.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  setShowCancelModal(false);
                }}
                disabled={cancelOrder.isPending}
                className="app-press flex-1 rounded-xl py-2.5 text-xs font-semibold"
                style={{
                  background: "var(--app-surface-2, rgba(0,0,0,0.05))",
                }}
              >
                Залишити
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic("medium");
                  cancelOrder.mutate(order.id, {
                    onSuccess: () => {
                      hapticNotify("success");
                      setShowCancelModal(false);
                    },
                    onError: (err) => {
                      hapticNotify("error");
                      alert(err instanceof Error ? err.message : "Помилка при скасуванні");
                      setShowCancelModal(false);
                    },
                  });
                }}
                disabled={cancelOrder.isPending}
                className="app-press flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition"
                style={{
                  background: "#ef4444",
                }}
              >
                {cancelOrder.isPending ? "Скасування..." : "Так, скасувати"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
