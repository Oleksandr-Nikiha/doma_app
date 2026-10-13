import type { OrderOut } from "../../types/order.ts";

interface OrderDetailsCardProps {
  order: OrderOut;
}

export function OrderDetailsCard({ order }: OrderDetailsCardProps) {
  const isDelivery = order.fulfillment_type === "delivery";

  return (
    <div className="space-y-4">
      {/* Деталі доставки та контакти */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#EADFCF] space-y-3.5 text-xs sm:text-sm shadow-2xs">
        <div className="text-xs font-bold uppercase tracking-wider text-[#8D7B6D] pb-1 border-b border-[#F0E6D8]">
          Інформація про замовлення
        </div>

        <div className="flex justify-between items-start gap-4">
          <span className="text-[#7A695C] shrink-0">Отримувач:</span>
          <span className="font-bold text-[#2C1E14] text-right">
            {order.contact_name} •{" "}
            <a href={`tel:${order.contact_phone}`} className="hover:underline text-[#C8823E]">
              {order.contact_phone}
            </a>
          </span>
        </div>

        <div className="flex justify-between items-start gap-4">
          <span className="text-[#7A695C] shrink-0">Спосіб:</span>
          <span className="font-bold text-[#2C1E14] text-right">
            {isDelivery ? (
              <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                🛵 Доставка: {order.delivery_address || "м. Вишгород"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[#C8823E] bg-[#FFF8EE] px-2 py-0.5 rounded-md border border-[#E8DFC8]">
                🛍️ Самовивіз: вул. Набережна, 8Д
              </span>
            )}
          </span>
        </div>

        <div className="flex justify-between items-start gap-4">
          <span className="text-[#7A695C] shrink-0">Час виконання:</span>
          <span className="font-bold text-[#2C1E14] text-right">
            {order.scheduled_time
              ? `🕒 На бажаний час: ${order.scheduled_time}`
              : "⚡ Якнайшвидше (орієнтовно 35–45 хв)"}
          </span>
        </div>

        <div className="flex justify-between items-start gap-4">
          <span className="text-[#7A695C] shrink-0">Оплата:</span>
          <span className="font-bold text-[#2C1E14] text-right">
            {order.payment_method === "cash"
              ? "💵 Готівкою під час отримання"
              : "💳 Банківською карткою"}
          </span>
        </div>

        {order.comment && (
          <div className="pt-2 border-t border-[#F0E6D8]">
            <span className="text-[#7A695C] block mb-1">Коментар до замовлення:</span>
            <p className="bg-[#FAF7F2] p-2.5 rounded-xl border border-[#EADFCF] text-[#4A3B32] italic text-xs">
              «{order.comment}»
            </p>
          </div>
        )}
      </div>

      {/* Склад замовлених страв */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#EADFCF] space-y-3 shadow-2xs">
        <div className="flex items-center justify-between pb-1 border-b border-[#F0E6D8]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8D7B6D]">
            Склад замовлення
          </span>
          <span className="text-xs text-[#7A695C]">
            {order.groups.reduce((acc, g) => acc + g.items.length, 0)} позицій
          </span>
        </div>

        <div className="divide-y divide-[#F3EDE2] space-y-0.5">
          {order.groups.flatMap((g) => g.items).map((item) => (
            <div key={item.id} className="py-2.5 flex items-start justify-between gap-3 text-xs sm:text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[#2C1E14]">
                  {item.product_name}
                </div>
                <div className="text-[11px] text-[#8D7B6D] mt-0.5">
                  {item.variant_label} • {item.qty} шт × {item.unit_price} ₴
                </div>
                {item.options && item.options.length > 0 && (
                  <div className="text-[11px] text-[#A06C3E] mt-0.5">
                    + {item.options.map((o) => `${o.option_name} (+${o.price_delta} ₴)`).join(", ")}
                  </div>
                )}
              </div>
              <div className="font-extrabold text-[#2C1E14] shrink-0">
                {item.subtotal} ₴
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[#E8DFC8] flex items-center justify-between font-bold">
          <span className="text-sm text-[#2C1E14]">Сума до сплати:</span>
          <span className="text-xl text-[#C8823E] font-extrabold">
            {order.total_price} ₴
          </span>
        </div>
      </div>
    </div>
  );
}

