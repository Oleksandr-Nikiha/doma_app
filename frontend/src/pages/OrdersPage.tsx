import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useOrders, useRepeatOrder } from "@/api/queries";
import { EmptyState, ErrorBox, ScreenTitle, formatPrice } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic, hapticNotify } from "@/telegram/sdk";
import type { Order } from "@/api/types";

function getStatusBadge(status: string, fulfillmentType?: string) {
  switch (status) {
    case "confirmed":
      return {
        label: "✅ Підтверджено",
        color: "#22c55e",
        bg: "rgba(34, 197, 94, 0.12)",
      };
    case "in_progress":
      return {
        label: "👨‍🍳 Готується",
        color: "#3b82f6",
        bg: "rgba(59, 130, 246, 0.12)",
      };
    case "ready":
      return {
        label: fulfillmentType === "delivery" ? "🛵 В дорозі" : "🛍️ Готове до видачі",
        color: "#8b5cf6",
        bg: "rgba(139, 92, 246, 0.12)",
      };
    case "completed":
      return {
        label: "🎉 Виконано",
        color: "#22c55e",
        bg: "rgba(34, 197, 94, 0.12)",
      };
    case "rejected":
      return {
        label: "❌ Відхилено",
        color: "#ef4444",
        bg: "rgba(239, 68, 68, 0.12)",
      };
    case "cancelled":
      return {
        label: "🚫 Скасовано",
        color: "#ef4444",
        bg: "rgba(239, 68, 68, 0.12)",
      };
    case "pending_moderation":
    default:
      return {
        label: "⏳ Очікує підтвердження",
        color: "#eab308",
        bg: "rgba(234, 179, 8, 0.12)",
      };
  }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function OrdersPage() {
  const navigate = useNavigate();
  useBackButton(() => navigate("/profile"));

  const { data: orders, isPending, error, refetch } = useOrders();
  const repeatOrder = useRepeatOrder();
  const [repeatingOrderId, setRepeatingOrderId] = useState<number | null>(null);

  const handleRepeatOrder = (orderId: number) => {
    haptic("medium");
    setRepeatingOrderId(orderId);
    repeatOrder.mutate(
      { orderId },
      {
        onSuccess: (res) => {
          hapticNotify("success");
          setRepeatingOrderId(null);
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
          setRepeatingOrderId(null);
          alert(err instanceof Error ? err.message : "Не вдалося повторити замовлення");
        },
      }
    );
  };

  if (isPending) {
    return (
      <div className="pb-8">
        <ScreenTitle>Мої замовлення</ScreenTitle>
        <div className="space-y-3 px-4 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="app-card rounded-2xl p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-5 w-28 rounded-md app-shimmer" />
                <div className="h-5 w-24 rounded-full app-shimmer opacity-60" />
              </div>
              <div className="h-4 w-40 rounded-md app-shimmer opacity-50" />
              <div className="h-4 w-full rounded-md app-shimmer opacity-40 pt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pb-8">
        <ScreenTitle>Мої замовлення</ScreenTitle>
        <ErrorBox message={error.message} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="pb-8">
        <ScreenTitle>Мої замовлення</ScreenTitle>
        <EmptyState
          icon="📦"
          title="У вас ще немає замовлень"
          hint="Оберіть смачні страви з меню та оформіть перше замовлення!"
        />
        <div className="px-4 mt-2">
          <button
            onClick={() => {
              haptic("light");
              navigate("/");
            }}
            className="app-press w-full rounded-xl py-3 font-bold shadow-md transition"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            Перейти до меню
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <ScreenTitle>Мої замовлення</ScreenTitle>

      <div className="app-rise space-y-3 px-4 pt-1">
        {orders.map((order: Order) => {
          const badge = getStatusBadge(order.status, order.fulfillment_type);
          const locationName = order.groups[0]?.location_name || "Doma";
          const isCroissant = locationName.toLowerCase().includes("croissant");
          const allItems = order.groups.flatMap((g) => g.items);

          return (
            <div
              key={order.id}
              onClick={() => {
                haptic("light");
                navigate(`/orders/${order.id}/success`);
              }}
              className="app-card app-press rounded-2xl p-4 cursor-pointer transition-all space-y-2.5"
            >
              {/* Шапка картки */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-base flex items-center gap-1.5">
                    <span>{isCroissant ? "🥐" : "🍕"}</span>
                    <span>Замовлення #{order.id}</span>
                  </p>
                  <p className="text-[11px] opacity-50 mt-0.5">
                    {formatDate(order.created_at)} · {locationName}
                  </p>
                </div>

                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold shrink-0"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
              </div>

              {/* Спосіб отримання */}
              <div className="flex items-center gap-2 text-xs opacity-75">
                <span>
                  {order.fulfillment_type === "delivery" ? "🛵 Доставка" : "🛍️ Самовивіз"}
                </span>
                <span>·</span>
                <span>
                  {order.scheduled_time ? `⏰ На ${order.scheduled_time}` : "⚡ Якнайшвидше"}
                </span>
              </div>

              {/* Короткий список страв */}
              <div
                className="pt-2 border-t text-xs opacity-70 leading-relaxed truncate"
                style={{ borderColor: "var(--app-border)" }}
              >
                {allItems.map((it) => `${it.product_name} ×${it.qty}`).join(", ")}
              </div>

              {/* Футер: сума та стрілочка */}
              <div
                className="flex items-center justify-between pt-2 border-t"
                style={{ borderColor: "var(--app-border)" }}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs opacity-50">Сума:</span>
                  <span className="text-base font-extrabold text-[var(--tg-theme-button-color)]">
                    {formatPrice(order.total_price)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRepeatOrder(order.id);
                    }}
                    disabled={repeatingOrderId === order.id}
                    className="app-press rounded-xl px-2.5 py-1 text-xs font-semibold flex items-center gap-1 transition"
                    style={{
                      background: "var(--app-surface-2)",
                      color: "var(--tg-theme-button-color)",
                    }}
                  >
                    <span>🔁</span>
                    <span>{repeatingOrderId === order.id ? "Додаємо..." : "Повторити"}</span>
                  </button>

                  <span className="text-xs font-semibold text-[var(--tg-theme-button-color)] flex items-center gap-0.5">
                    <span>Деталі</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

