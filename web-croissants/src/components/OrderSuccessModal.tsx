import { useEffect, useState } from "react";
import { fetchWebOrder } from "../api/client.ts";
import type { OrderOut } from "../types/order.ts";

interface OrderSuccessModalProps {
  order: OrderOut;
  onClose: () => void;
}

export function OrderSuccessModal({ order: initialOrder, onClose }: OrderSuccessModalProps) {
  const [order, setOrder] = useState<OrderOut>(initialOrder);

  // Періодичне опитування стану замовлення
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWebOrder(order.id)
        .then(setOrder)
        .catch(() => {});
    }, 8000);

    return () => clearInterval(interval);
  }, [order.id]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending_moderation":
        return {
          icon: "⏳",
          label: "Очікує підтвердження персоналом",
          color: "bg-amber-950/40 text-amber-300 border-amber-500/30",
        };
      case "confirmed":
      case "in_progress":
        return {
          icon: "👨‍🍳",
          label: "Замовлення готується",
          color: "bg-sky-950/40 text-sky-300 border-sky-500/30",
        };
      case "ready":
        return {
          icon: "🛍️",
          label: "Готово! Можна забирати або чекати кур'єра",
          color: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
        };
      case "completed":
        return {
          icon: "✅",
          label: "Успішно виконано",
          color: "bg-green-950/40 text-green-300 border-green-500/30",
        };
      case "cancelled":
      case "rejected":
        return {
          icon: "❌",
          label: "Скасовано",
          color: "bg-red-950/40 text-red-300 border-red-500/30",
        };
      default:
        return {
          icon: "📦",
          label: "Обробляється",
          color: "bg-slate-900 text-slate-300 border-slate-700",
        };
    }
  };

  const statusInfo = getStatusInfo(order.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-[#14171E] rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] overflow-y-auto shadow-2xl border border-white/10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 text-[#F1F5F9]">
        <div className="p-6 sm:p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-950/40 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center text-4xl mx-auto shadow-sm">
            🎉
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
              Замовлення #{order.id} прийнято!
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-xs mx-auto">
              Дякуємо! Сповіщення вже надіслано на кухню пекарні Urban Bakery & Coffee.
            </p>
          </div>

          {/* Статус замовлення в реальному часі */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-sm font-bold ${statusInfo.color}`}
          >
            <span className="text-lg">{statusInfo.icon}</span>
            <span>{statusInfo.label}</span>
          </div>

          {/* Інформація про замовлення */}
          <div className="p-4 rounded-2xl bg-[#181B22] border border-white/10 text-left text-xs sm:text-sm space-y-2.5 shadow-lg">
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Отримувач:</span>
              <span className="font-bold text-[#F1F5F9]">
                {order.contact_name} ({order.contact_phone})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Спосіб:</span>
              <span className="font-bold text-[#F1F5F9]">
                {order.fulfillment_type === "delivery"
                  ? `🛵 Доставка: ${order.delivery_address || ""}`
                  : "🛍️ Самовивіз (вул. Велика Васильківська, 24)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Оплата:</span>
              <span className="font-bold text-[#F1F5F9]">
                {order.payment_method === "cash" ? "💵 Готівкою" : "💳 Карткою"}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-base">
              <span className="text-[#F1F5F9]">Сума до сплати:</span>
              <span className="text-[#E69A38]">{order.total_price} ₴</span>
            </div>
          </div>

          <div className="text-xs text-[#94A3B8] space-y-1">
            <p>
              Якщо у вас виникнуть запитання щодо замовлення, зателефонуйте нам:
            </p>
            <a
              href="tel:+380442220022"
              className="font-bold text-[#E69A38] hover:underline"
            >
              📞 +380 (44) 222-00-22
            </a>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-full bg-[#E69A38] hover:bg-[#D4892A] text-white py-3.5 px-6 rounded-2xl font-bold text-base shadow-lg shadow-[#E69A38]/20 transition-all active:scale-98 cursor-pointer"
          >
            Зрозуміло, дякую!
          </button>
        </div>
      </div>
    </div>
  );
}

