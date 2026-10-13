import { useState } from "react";
import type { OrderOut } from "../../types/order.ts";

interface OrdersHistoryTabProps {
  orders: OrderOut[];
  loading: boolean;
  onRepeatOrder: (order: OrderOut) => void;
  onOpenTracking: (orderId: number) => void;
  onRefresh: () => void;
}

export function OrdersHistoryTab({
  orders,
  loading,
  onRepeatOrder,
  onOpenTracking,
  onRefresh,
}: OrdersHistoryTabProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return { label: "Виконано 🎉", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "delivering":
      case "on_the_way":
        return { label: "У дорозі 🛵", badge: "bg-amber-100 text-amber-900 border-amber-200" };
      case "ready":
      case "ready_for_pickup":
        return { label: "Готово до видачі 🛍️", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "in_progress":
      case "cooking":
        return { label: "Випікається 👨‍🍳", badge: "bg-orange-100 text-orange-900 border-orange-200" };
      case "confirmed":
        return { label: "Підтверджено ✅", badge: "bg-sky-100 text-sky-900 border-sky-200" };
      case "cancelled":
      case "rejected":
        return { label: "Скасовано ❌", badge: "bg-red-100 text-red-800 border-red-200" };
      default:
        return { label: "Очікує підтвердження ⏳", badge: "bg-amber-50 text-amber-800 border-amber-200" };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("uk-UA", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#C8823E] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-[#7A695C]">Завантажуємо історію замовлень...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-10 px-4 space-y-3 bg-[#FAF7F2] rounded-2xl border border-[#EADFCF]">
        <span className="text-4xl block">🍕🍣</span>
        <h4 className="font-display text-base font-bold text-[#2C1E14]">
          У вас поки немає замовлень
        </h4>
        <p className="text-xs text-[#7A695C] max-w-sm mx-auto leading-relaxed">
          Оберіть улюблену піцу, свіжі роли або бургер в нашому меню та оформіть перше замовлення!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between text-xs text-[#7A695C] px-1">
        <span>Знайдено замовлень: <strong className="text-[#2C1E14]">{orders.length}</strong></span>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[#9C5B23] hover:underline font-bold flex items-center gap-1 cursor-pointer"
        >
          <span>🔄</span>
          <span>Оновити список</span>
        </button>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const st = getStatusBadge(order.status);
          const isExpanded = expandedOrderId === order.id;
          const allItems = order.groups.flatMap((g) => g.items);
          const isDelivery = order.fulfillment_type === "delivery";

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-[#E8DFC8] overflow-hidden shadow-2xs hover:border-[#D5C7B3] transition-all"
            >
              <div className="p-4 space-y-2.5">
                {/* Верхній рядок: ID, Дата і Статус */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-[#2C1E14] text-base">
                        #{order.id}
                      </span>
                      <span className="text-xs text-[#8D7B6D]">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                    <div className="text-xs text-[#7A695C] mt-0.5">
                      {isDelivery ? "🛵 Доставка" : "🛍️ Самовивіз"} • {allItems.length} позицій
                    </div>
                  </div>

                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${st.badge} whitespace-nowrap`}>
                    {st.label}
                  </span>
                </div>

                {/* Короткий прев'ю страв */}
                <div className="text-xs text-[#4A3B32] line-clamp-1">
                  {allItems.map((i) => `${i.product_name} (${i.qty} шт)`).join(", ")}
                </div>

                {/* Розгорнутий перелік страв за кліком */}
                {isExpanded && (
                  <div className="pt-3 border-t border-[#F3EDE2] space-y-2 animate-in fade-in duration-200">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#8D7B6D]">
                      Склад замовлення:
                    </div>
                    <div className="divide-y divide-[#F3EDE2] text-xs">
                      {allItems.map((item) => (
                        <div key={item.id} className="py-2 flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-[#2C1E14]">{item.product_name}</div>
                            <div className="text-[11px] text-[#8D7B6D]">
                              {item.variant_label} • {item.qty} шт × {item.unit_price} ₴
                            </div>
                            {item.options && item.options.length > 0 && (
                              <div className="text-[11px] text-[#A06C3E]">
                                + {item.options.map((o) => o.option_name).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="font-extrabold text-[#2C1E14] shrink-0">
                            {item.subtotal} ₴
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.delivery_address && (
                      <div className="text-xs text-[#7A695C] pt-2 border-t border-[#F3EDE2]">
                        📍 <strong>Адреса:</strong> {order.delivery_address}
                      </div>
                    )}
                  </div>
                )}

                {/* Нижній рядок: Сума і Дії */}
                <div className="pt-2.5 border-t border-[#F3EDE2] flex items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-[#2C1E14]">
                    {order.total_price} ₴
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="text-xs text-[#7A695C] hover:text-[#2C1E14] px-2 py-1.5 rounded-lg hover:bg-[#F3EDE2] font-semibold transition-colors cursor-pointer"
                    >
                      {isExpanded ? "Згорнути ▲" : "Деталі ▼"}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenTracking(order.id)}
                      className="text-xs bg-[#FAF7F2] hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] px-2.5 py-1.5 rounded-xl font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>📍</span>
                      <span>Трекінг</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRepeatOrder(order)}
                      className="text-xs bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-3 py-1.5 rounded-xl font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span>🔁</span>
                      <span>Повторити</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

