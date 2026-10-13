import { useEffect, useState } from "react";
import { fetchWebOrder } from "../api/client.ts";
import { useModalBehavior } from "../hooks/useModalBehavior.ts";
import type { OrderOut } from "../types/order.ts";

interface OrderSuccessModalProps {
  order: OrderOut;
  onClose: () => void;
}

export function OrderSuccessModal({ order: initialOrder, onClose }: OrderSuccessModalProps) {
  useModalBehavior({ isOpen: true, onClose });
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
          color: "bg-amber-100 text-amber-800 border-amber-200",
        };
      case "confirmed":
      case "in_progress":
        return {
          icon: "👨‍🍳",
          label: "Замовлення готується",
          color: "bg-sky-100 text-sky-800 border-sky-200",
        };
      case "ready":
        return {
          icon: "🛍️",
          label: "Готово! Можна забирати або чекати кур'єра",
          color: "bg-emerald-100 text-emerald-800 border-emerald-200",
        };
      case "completed":
        return {
          icon: "✅",
          label: "Успішно виконано",
          color: "bg-green-100 text-green-800 border-green-200",
        };
      case "cancelled":
      case "rejected":
        return {
          icon: "❌",
          label: "Скасовано",
          color: "bg-red-100 text-red-800 border-red-200",
        };
      default:
        return {
          icon: "📦",
          label: "Обробляється",
          color: "bg-gray-100 text-gray-800 border-gray-200",
        };
    }
  };

  const statusInfo = getStatusInfo(order.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] overflow-y-auto shadow-2xl border border-[#E8DFC8] animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center text-4xl mx-auto shadow-sm">
            🎉
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#2C1E14]">
              Замовлення #{order.id} прийнято!
            </h2>
            <p className="text-sm text-[#614F42] max-w-xs mx-auto">
              Дякуємо! Сповіщення вже надіслано на кухню ресторану Doma Pizza & Sushi.
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
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EADFCF] text-left text-xs sm:text-sm space-y-2.5">
            <div className="flex justify-between">
              <span className="text-[#7A695C]">Отримувач:</span>
              <span className="font-bold text-[#2C1E14]">
                {order.contact_name} ({order.contact_phone})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7A695C]">Спосіб:</span>
              <span className="font-bold text-[#2C1E14]">
                {order.fulfillment_type === "delivery"
                  ? `🛵 Доставка: ${order.delivery_address || ""}`
                  : "🛍️ Самовивіз (просп. Шевченка, 2Д)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7A695C]">Оплата:</span>
              <span className="font-bold text-[#2C1E14]">
                {order.payment_method === "cash" ? "💵 Готівкою" : "💳 Карткою"}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E8DFC8] font-bold text-base">
              <span className="text-[#2C1E14]">Сума до сплати:</span>
              <span className="text-[#C8823E]">{order.total_price} ₴</span>
            </div>
          </div>

          <div className="text-xs text-[#8D7B6D] space-y-1">
            <p>
              Якщо у вас виникнуть запитання щодо замовлення, зателефонуйте нам:
            </p>
            <a
              href="tel:+380931127733"
              className="font-bold text-[#C8823E] hover:underline"
            >
              📞 +380 93 112 77 33
            </a>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-full bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-3.5 px-6 rounded-2xl font-bold text-base shadow-md transition-all active:scale-98 cursor-pointer"
          >
            Зрозуміло, дякую!
          </button>
        </div>
      </div>
    </div>
  );
}

