import { useEffect, useState } from "react";
import { fetchWebOrder } from "../api/client.ts";
import type { OrderOut } from "../types/order.ts";

export const LAST_ORDER_STORAGE_KEY = "doma_last_order_id";
export const ORDERS_HISTORY_STORAGE_KEY = "doma_orders_history";

interface OrderTrackingModalProps {
  orderId: number | null;
  initialOrder?: OrderOut | null;
  isOpen: boolean;
  onClose: () => void;
  isNewlyCreated?: boolean;
}

export function OrderTrackingModal({
  orderId: propOrderId,
  initialOrder,
  isOpen,
  onClose,
  isNewlyCreated = false,
}: OrderTrackingModalProps) {
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(
    propOrderId || initialOrder?.id || null,
  );
  const [order, setOrder] = useState<OrderOut | null>(initialOrder || null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchIdInput, setSearchIdInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [recentOrderIds, setRecentOrderIds] = useState<number[]>([]);

  // Синхронізація при зміні пропсів
  useEffect(() => {
    if (propOrderId) {
      setCurrentOrderId(propOrderId);
    } else if (initialOrder) {
      setCurrentOrderId(initialOrder.id);
      setOrder(initialOrder);
    }
  }, [propOrderId, initialOrder]);

  // Завантаження локальної історії замовлень
  useEffect(() => {
    if (!isOpen) return;
    try {
      const savedHist = JSON.parse(
        localStorage.getItem(ORDERS_HISTORY_STORAGE_KEY) || "[]",
      );
      if (Array.isArray(savedHist)) {
        setRecentOrderIds(savedHist);
      }
    } catch {}
  }, [isOpen]);

  // Завантаження замовлення при відкритті або зміні ID
  useEffect(() => {
    if (!isOpen || !currentOrderId) return;

    let isMounted = true;

    // Якщо замовлення вже є в пропсах і це перше відкриття, не показуємо повний loader
    if (!order || order.id !== currentOrderId) {
      setLoading(true);
      setError(null);
    }

    fetchWebOrder(currentOrderId)
      .then((data) => {
        if (!isMounted) return;
        setOrder(data);
        setError(null);
        try {
          localStorage.setItem(LAST_ORDER_STORAGE_KEY, String(data.id));
          const savedHist = JSON.parse(
            localStorage.getItem(ORDERS_HISTORY_STORAGE_KEY) || "[]",
          );
          const updated = Array.from(new Set([data.id, ...(Array.isArray(savedHist) ? savedHist : [])])).slice(0, 10);
          localStorage.setItem(ORDERS_HISTORY_STORAGE_KEY, JSON.stringify(updated));
          setRecentOrderIds(updated);
        } catch {}
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Не вдалося знайти замовлення");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentOrderId]);

  // Автоматичне опитування кожні 12 секунд для активних замовлень
  useEffect(() => {
    if (!isOpen || !currentOrderId || !order) return;

    // Зупиняємо опитування, якщо замовлення вже виконано або скасовано
    if (["completed", "cancelled", "rejected"].includes(order.status)) {
      return;
    }

    const interval = setInterval(() => {
      fetchWebOrder(currentOrderId)
        .then((updated) => {
          setOrder(updated);
        })
        .catch(() => {});
    }, 12000);

    return () => clearInterval(interval);
  }, [isOpen, currentOrderId, order]);

  // Ручне оновлення статусу
  const handleManualRefresh = async () => {
    if (!currentOrderId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const data = await fetchWebOrder(currentOrderId);
      setOrder(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка оновлення");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Пошук іншого замовлення за введеним номером
  const handleSearchOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(searchIdInput.trim().replace(/^#/, ""), 10);
    if (!parsed || isNaN(parsed)) return;
    setCurrentOrderId(parsed);
    setSearchIdInput("");
  };

  // Копіювання посилання на трекінг
  const handleCopyLink = () => {
    if (!order) return;
    const trackingUrl = `${window.location.origin}${window.location.pathname}?order=${order.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(trackingUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } else {
      // Fallback
      window.prompt("Скопіюйте посилання на відстеження:", trackingUrl);
    }
  };

  if (!isOpen) return null;

  const isDelivery = order?.fulfillment_type === "delivery";

  // Визначення кроку та опису статусу
  const getStepData = (status: string, isDeliv: boolean) => {
    if (status === "cancelled" || status === "rejected") {
      return {
        stepIndex: -1,
        isCancelled: true,
        title: "Замовлення скасовано ❌",
        desc: "На жаль, замовлення було скасовано або відхилено. Якщо у вас є запитання, зателефонуйте менеджеру.",
        badge: "bg-red-100 text-red-800 border-red-200",
      };
    }

    if (status === "completed") {
      return {
        stepIndex: 4,
        isCompleted: true,
        title: isDeliv ? "Замовлення доставлено! 🎉" : "Замовлення видано! 🎉",
        desc: "Дякуємо, що обираєте Doma Croissants! Бажаємо приємного смаку та гарного настрою!",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    }

    if (status === "on_the_way" || status === "delivering") {
      return {
        stepIndex: 3,
        title: "Кур'єр уже в дорозі 🛵💨",
        desc: "Ваші хрусткі круасани та напої прямують за вказаною адресою в термосумці.",
        badge: "bg-amber-100 text-amber-900 border-amber-200",
      };
    }

    if (status === "ready" || status === "ready_for_pickup") {
      return {
        stepIndex: 3,
        title: isDeliv
          ? "Спаковано та чекає кур'єра 🛍️"
          : "Замовлення готове до видачі! 🛍️",
        desc: isDeliv
          ? "Страви свіжоспечені та чекають передачі в доставку."
          : "Завітайте до нашої пекарні: м. Вишгород, просп. Шевченка, 2Д.",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    }

    if (status === "in_progress" || status === "cooking") {
      return {
        stepIndex: 2,
        title: "Випікається на кухні 👨‍🍳🔥",
        desc: "Наші пекарі готують великі хрусткі круасани та ваші страви прямо зараз.",
        badge: "bg-orange-100 text-orange-900 border-orange-200",
      };
    }

    if (status === "confirmed") {
      return {
        stepIndex: 1,
        title: "Замовлення підтверджено ✅",
        desc: "Пекарня підтвердила деталі та готується до випікання страв своєчасно.",
        badge: "bg-sky-100 text-sky-900 border-sky-200",
      };
    }

    // За замовчуванням (pending / pending_moderation)
    return {
      stepIndex: 0,
      title: "Очікує підтвердження пекарні ⏳",
      desc: "Замовлення надійшло до системи. Менеджер бере його в роботу.",
      badge: "bg-amber-100 text-amber-900 border-amber-200",
    };
  };

  const stepsList = isDelivery
    ? [
        { label: "Прийнято", icon: "📋" },
        { label: "Підтверджено", icon: "✅" },
        { label: "Готується", icon: "👨‍🍳" },
        { label: "У дорозі", icon: "🛵" },
        { label: "Доставлено", icon: "🎉" },
      ]
    : [
        { label: "Прийнято", icon: "📋" },
        { label: "Підтверджено", icon: "✅" },
        { label: "Готується", icon: "👨‍🍳" },
        { label: "Готово", icon: "🛍️" },
        { label: "Видано", icon: "🎉" },
      ];

  const currentStepInfo = order ? getStepData(order.status, isDelivery) : null;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("uk-UA", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Клік по фону для закриття */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#E8DFC8] z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        {/* Хедер модалки — закріплений зверху */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-[#EADFCF] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl">📦</span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#2C1E14]">
                {order ? `Замовлення #${order.id}` : "Відстеження замовлення"}
              </h2>
              <p className="text-xs text-[#7A695C]">
                {order ? `Створено: ${formatDate(order.created_at)}` : "Перевірка статусу наживо"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <button
                type="button"
                onClick={handleManualRefresh}
                title="Оновити статус"
                disabled={isRefreshing}
                className="w-9 h-9 rounded-full bg-white hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs active:scale-95 transition-transform"
              >
                <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
              </button>
            )}
            <button
              onClick={onClose}
              type="button"
              aria-label="Закрити"
              className="w-9 h-9 rounded-full bg-white hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Тіло модалки зі скролом */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">
          {/* Святковий банер, якщо замовлення щойно оформлено */}
          {isNewlyCreated && order && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs animate-in zoom-in-95 duration-300">
              <span className="text-2xl shrink-0">🎉</span>
              <div className="space-y-1">
                <div className="font-bold text-sm sm:text-base">
                  Дякуємо! Замовлення успішно передано до пекарні
                </div>
                <p className="text-emerald-800 text-xs leading-relaxed">
                  Кухня вже отримала сповіщення. Ви можете слідкувати за приготуванням та доставкою прямо на цій сторінці.
                </p>
              </div>
            </div>
          )}

          {/* Завантаження або помилка */}
          {loading && !order && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-3 border-[#C8823E] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-[#614F42]">
                Завантажуємо інформацію про замовлення...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <p className="text-xs text-red-700">
                Перевірте правильність номера замовлення або введіть інший нижче:
              </p>
              <form onSubmit={handleSearchOrder} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Введіть номер, наприклад: 42"
                  value={searchIdInput}
                  onChange={(e) => setSearchIdInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-700 text-white font-bold text-xs rounded-xl hover:bg-red-800 transition-colors"
                >
                  Знайти
                </button>
              </form>
            </div>
          )}

          {order && currentStepInfo && (
            <>
              {/* Головна картка поточного статусу */}
              <div className={`p-4 sm:p-5 rounded-2xl border ${currentStepInfo.badge} space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                    Поточний статус
                  </span>
                  <span className="text-xs font-semibold opacity-75">
                    Автооновлення кожні 12 сек
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-lg sm:text-xl font-bold leading-tight">
                    {currentStepInfo.title}
                  </h3>
                  <p className="text-xs sm:text-sm mt-1 leading-relaxed opacity-90">
                    {currentStepInfo.desc}
                  </p>
                </div>
              </div>

              {/* Візуальний шкальний степер (Timeline) */}
              {!currentStepInfo.isCancelled && (
                <div className="bg-[#FAF7F2] p-4 sm:p-5 rounded-2xl border border-[#EADFCF] space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#8D7B6D]">
                    Етапи виконання
                  </div>

                  {/* Горизонтальна шкала для екранів */}
                  <div className="relative flex items-center justify-between">
                    {/* Лінія бекграунду */}
                    <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-[#E2D5C3] z-0" />

                    {/* Активна лінія прогресу */}
                    <div
                      className="absolute left-4 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 transition-all duration-700 z-0"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            (currentStepInfo.stepIndex / (stepsList.length - 1)) * 100,
                          ),
                        )}%`,
                      }}
                    />

                    {/* Кроки степера */}
                    {stepsList.map((st, idx) => {
                      const isPassed = idx < currentStepInfo.stepIndex;
                      const isCurrent = idx === currentStepInfo.stepIndex;

                      return (
                        <div
                          key={st.label}
                          className="relative z-10 flex flex-col items-center group"
                        >
                          <div
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 ${
                              isPassed
                                ? "bg-emerald-500 text-white shadow-sm ring-4 ring-[#FAF7F2]"
                                : isCurrent
                                ? "bg-[#2C1E14] text-white ring-4 ring-[#2C1E14]/15 shadow-md scale-110"
                                : "bg-white text-[#8D7B6D] border border-[#D5C7B3] ring-4 ring-[#FAF7F2]"
                            }`}
                          >
                            {isPassed ? "✓" : st.icon}
                          </div>
                          <span
                            className={`text-[10px] sm:text-xs font-bold mt-2 whitespace-nowrap text-center ${
                              isCurrent
                                ? "text-[#2C1E14] font-extrabold"
                                : isPassed
                                ? "text-emerald-700"
                                : "text-[#8D7B6D]"
                            }`}
                          >
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                        🛍️ Самовивіз: просп. Шевченка, 2Д
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

              {/* Швидкі дії: Поділитися лінком та Телефон */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full bg-[#FAF7F2] hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>{copied ? "✅" : "🔗"}</span>
                  <span>{copied ? "Скопійовано!" : "Скопіювати лінк"}</span>
                </button>

                <a
                  href="tel:+380931127733"
                  className="w-full bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all active:scale-98 flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <span>📞</span>
                  <span>Подзвонити в заклад</span>
                </a>
              </div>
            </>
          )}

          {/* Швидкий вибір із нещодавніх замовлень клієнта на цьому пристрої */}
          {recentOrderIds.length > 1 && (
            <div className="pt-4 border-t border-[#EADFCF] space-y-2">
              <span className="text-[11px] font-bold text-[#8D7B6D] uppercase tracking-wider block">
                Ваші недавні замовлення:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {recentOrderIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCurrentOrderId(id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      currentOrderId === id
                        ? "bg-[#2C1E14] text-white shadow-2xs"
                        : "bg-[#F3EDE2] hover:bg-[#EADFCF] text-[#4A3B32] border border-[#E2D5C3]"
                    }`}
                  >
                    #{id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Форма пошуку іншого замовлення за потреби */}
          <div className="pt-3 border-t border-[#EADFCF] flex items-center justify-between text-xs text-[#7A695C]">
            <span>Потрібно відстежити інше замовлення?</span>
            <form onSubmit={handleSearchOrder} className="flex gap-1.5">
              <input
                type="text"
                placeholder="# замовлення"
                value={searchIdInput}
                onChange={(e) => setSearchIdInput(e.target.value)}
                className="w-24 px-2 py-1 text-xs rounded-lg border border-[#D5C7B3] bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-[#2C1E14] text-white rounded-lg font-bold text-[11px]"
              >
                Знайти
              </button>
            </form>
          </div>
        </div>

        {/* Закріплений футер */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-[#EADFCF] bg-[#FAF7F2] flex justify-end">
          <button
            onClick={onClose}
            type="button"
            className="w-full sm:w-auto bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-2.5 px-6 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}

