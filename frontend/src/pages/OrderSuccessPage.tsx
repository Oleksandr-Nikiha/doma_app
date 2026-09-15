import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useOrder } from "@/api/queries";
import { ErrorBox, ScreenTitle, Spinner, formatPrice } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function OrderSuccessPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const id = orderId ? parseInt(orderId, 10) : 0;

  useBackButton(() => navigate("/"));

  const { data: order, isPending, error, refetch } = useOrder(id);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!order) return;
    if (prevStatusRef.current && prevStatusRef.current !== order.status) {
      if (order.status === "confirmed") {
        hapticNotify("success");
      } else if (order.status === "rejected") {
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
          text: "✅ Підтверджено",
          subtitle: "Замовлення підтверджено! Ми вже розпочали приготування 🍕✨",
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
        };
      case "rejected":
        return {
          text: "❌ Відхилено",
          subtitle: "На жаль, замовлення відхилено. Менеджер зателефонує для уточнення деталей.",
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.12)",
        };
      case "in_progress":
        return {
          text: "👨‍🍳 Готується",
          subtitle: "Ваші страви вже на кухні!",
          color: "#3b82f6",
          bg: "rgba(59, 130, 246, 0.12)",
        };
      case "completed":
        return {
          text: "🎉 Виконано",
          subtitle: "Смачного! Дякуємо, що обираєте Doma.",
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
        };
      default:
        return {
          text: "⏳ Очікує підтвердження",
          subtitle: "Менеджер закладу перевіряє ваше замовлення",
          color: "#eab308",
          bg: "rgba(234, 179, 8, 0.12)",
        };
    }
  };

  const badge = statusBadge();

  return (
    <div className="pb-8">
      <ScreenTitle>Дякуємо!</ScreenTitle>

      <div className="app-rise space-y-4 px-4">
        {/* Головна картка успіху */}
        <div className="app-card rounded-2xl p-5 text-center">
          <div className="text-5xl">
            {order.status === "rejected" ? "😔" : "🎉"}
          </div>
          <h2 className="mt-3 text-lg font-bold">Замовлення #{order.id} {order.status === "confirmed" ? "підтверджено" : "прийнято"}</h2>
          <p className="mt-1 text-xs opacity-70 leading-relaxed max-w-[280px] mx-auto">
            {badge.subtitle}
          </p>

          <div className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>
            {badge.text}
          </div>
        </div>

        {/* Деталі замовлення */}
        <div className="app-card rounded-2xl p-4 space-y-3 text-xs">
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
              {order.payment_method === "cash" ? "💵 Готівка" : "💳 Картка"}
            </span>
          </div>
          {order.comment && (
            <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--app-border)" }}>
              <span className="opacity-60">Коментар</span>
              <span className="italic max-w-[65%] text-right">{order.comment}</span>
            </div>
          )}

          {/* Список страв */}
          <div className="pt-2 space-y-1.5">
            <p className="font-semibold opacity-60 uppercase text-[10px] tracking-wider">Страви:</p>
            {order.groups.flatMap((g) => g.items).map((item) => (
              <div key={item.id} className="flex justify-between text-xs py-0.5">
                <span className="truncate pr-2">
                  • {item.product_name} ({item.variant_label}) × {item.qty}
                  {item.options.length > 0 && (
                    <span className="opacity-60 block pl-2">
                      ↳ {item.options.map((o) => o.option_name).join(", ")}
                    </span>
                  )}
                </span>
                <span className="font-medium shrink-0">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-3 text-sm font-bold border-t" style={{ borderColor: "var(--app-border)" }}>
            <span>Разом</span>
            <span>{formatPrice(order.total_price)}</span>
          </div>
        </div>

        {/* Сповіщення в Telegram */}
        <div className="rounded-xl p-3.5 text-xs leading-relaxed" style={{ background: "var(--app-tint)", color: "var(--tg-theme-link-color)" }}>
          💬 <b>Сповіщення в чаті</b>
          <p className="mt-1 opacity-90">
            Статус замовлення оновлюється в реальному часі. Ви отримаєте повідомлення від бота, щойно замовлення буде підтверджено.
          </p>
        </div>

        {/* Кнопка на головну */}
        <button
          onClick={() => {
            haptic("light");
            navigate("/");
          }}
          className="app-press w-full rounded-xl py-3 font-semibold shadow transition"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
          }}
        >
          Повернутися до меню
        </button>
      </div>
    </div>
  );
}

