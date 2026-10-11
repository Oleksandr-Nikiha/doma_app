import { useState, useEffect, useMemo } from "react";
import {
  useAdminOrderDetail,
  useAdminVariantChoices,
  useUpdateAdminOrder,
  useNotifyAdminOrder,
  useAdminProducts,
  useAdminOptionGroups,
} from "@/api/queries";
import { Spinner, ErrorBox, formatPrice } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";
import { useBackButton } from "@/hooks/useBackButton";
import { calculateItemOptionsWithFreeQuota } from "@/utils/productOptions";
import {
  AddOptionToItemModal,
  type OrderItemDraft,
  type OrderItemOptionDraft,
} from "./AddOptionToItemModal";

export function OrderEditModal({
  orderId,
  onClose,
}: {
  orderId: number;
  onClose: () => void;
}) {
  useBackButton(onClose);

  const { data: order, isPending, error } = useAdminOrderDetail(orderId);
  const { data: variantChoices = [] } = useAdminVariantChoices();
  const { data: adminProducts = [] } = useAdminProducts();
  const { data: adminOptionGroups = [] } = useAdminOptionGroups();

  const updateOrder = useUpdateAdminOrder();
  const notifyOrder = useNotifyAdminOrder();

  const [status, setStatus] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [contactName, setContactName] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [addDishOpen, setAddDishOpen] = useState(false);
  const [dishSearch, setDishSearch] = useState("");

  const [targetItemIdx, setTargetItemIdx] = useState<number | null>(null);
  const [notified, setNotified] = useState(false);

  if (order && !isInitialized) {
    setStatus(order.status);
    setScheduledTime(order.scheduled_time || "");
    setDeliveryAddress(order.delivery_address || "");
    setContactName(order.contact_name);
    setContactPhone(order.contact_phone);
    setComment(order.comment || "");

    const initialItems: OrderItemDraft[] = [];
    for (const g of order.groups) {
      for (const it of g.items) {
        const choice = variantChoices.find((vc) => vc.variant_id === it.variant_id);
        const prod = adminProducts.find(
          (p) =>
            p.id === choice?.product_id ||
            (it.variant_id && p.variants.some((v) => v.id === it.variant_id)) ||
            p.name.toLowerCase() === it.product_name.toLowerCase()
        );

        initialItems.push({
          id: it.id,
          variant_id: it.variant_id,
          product_id: prod?.id ?? choice?.product_id ?? null,
          product_name: it.product_name,
          variant_label: it.variant_label,
          unit_price: it.unit_price,
          qty: it.qty,
          options: it.options.map((o) => ({
            option_group_name: o.option_group_name,
            option_name: o.option_name,
            price_delta: o.price_delta,
            qty: o.qty,
          })),
        });
      }
    }
    setItems(initialItems);
    setIsInitialized(true);
  }

  const getProductForDraft = (it: OrderItemDraft) => {
    return adminProducts.find(
      (p) =>
        (it.product_id && p.id === it.product_id) ||
        (it.variant_id && p.variants.some((v) => v.id === it.variant_id)) ||
        p.name.toLowerCase() === it.product_name.toLowerCase()
    );
  };

  const getOptionRulesForDraft = (it: OrderItemDraft) => {
    const prod = getProductForDraft(it);
    return prod?.option_groups ?? [];
  };

  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const rules = getOptionRulesForDraft(it);
      const calc = calculateItemOptionsWithFreeQuota(it.options, rules, it.unit_price, it.qty);
      return sum + calc.itemSubtotal;
    }, 0);
  }, [items, adminProducts]);

  const handleUpdateOptionQty = (
    itemIdx: number,
    groupName: string,
    optName: string,
    delta: number
  ) => {
    const next = [...items];
    const targetItem = next[itemIdx];
    const existingIdx = targetItem.options.findIndex(
      (o) =>
        o.option_group_name.trim().toLowerCase() === groupName.trim().toLowerCase() &&
        o.option_name.trim().toLowerCase() === optName.trim().toLowerCase()
    );

    if (existingIdx >= 0) {
      const current = targetItem.options[existingIdx];
      const newQty = current.qty + delta;
      if (newQty <= 0) {
        targetItem.options = targetItem.options.filter((_, i) => i !== existingIdx);
      } else {
        targetItem.options[existingIdx] = { ...current, qty: newQty };
      }
      setItems(next);
    }
  };

  const handleRemoveOption = (itemIdx: number, groupName: string, optName: string) => {
    const next = [...items];
    const targetItem = next[itemIdx];
    targetItem.options = targetItem.options.filter(
      (o) =>
        !(
          o.option_group_name.trim().toLowerCase() === groupName.trim().toLowerCase() &&
          o.option_name.trim().toLowerCase() === optName.trim().toLowerCase()
        )
    );
    setItems(next);
  };

  const handleAddOptionToItem = (
    itemIdx: number,
    groupName: string,
    optName: string,
    priceDelta: number
  ) => {
    const next = [...items];
    const targetItem = next[itemIdx];
    const existingIdx = targetItem.options.findIndex(
      (o) =>
        o.option_group_name.trim().toLowerCase() === groupName.trim().toLowerCase() &&
        o.option_name.trim().toLowerCase() === optName.trim().toLowerCase()
    );

    if (existingIdx >= 0) {
      targetItem.options[existingIdx].qty += 1;
    } else {
      targetItem.options.push({
        option_group_name: groupName.trim() || "Додатки",
        option_name: optName.trim(),
        price_delta: priceDelta,
        qty: 1,
      });
    }
    setItems(next);
  };

  const handleSave = () => {
    if (items.length === 0) {
      alert("Замовлення повинно містити щонайменше одну позицію!");
      return;
    }

    const preparedItems = items.map((it) => {
      const rules = getOptionRulesForDraft(it);
      const calc = calculateItemOptionsWithFreeQuota(it.options, rules, it.unit_price, it.qty);

      const preparedOptions: OrderItemOptionDraft[] = [];
      for (const b of calc.breakdown) {
        if (b.freeQty > 0 && b.paidQty === 0) {
          preparedOptions.push({
            option_group_name: b.option_group_name,
            option_name: b.option_name,
            price_delta: 0,
            qty: b.freeQty,
          });
        } else if (b.freeQty > 0 && b.paidQty > 0) {
          preparedOptions.push({
            option_group_name: b.option_group_name,
            option_name: b.option_name,
            price_delta: 0,
            qty: b.freeQty,
          });
          preparedOptions.push({
            option_group_name: b.option_group_name,
            option_name: b.option_name,
            price_delta: b.price_delta,
            qty: b.paidQty,
          });
        } else {
          preparedOptions.push({
            option_group_name: b.option_group_name,
            option_name: b.option_name,
            price_delta: b.price_delta,
            qty: b.paidQty,
          });
        }
      }

      return {
        variant_id: it.variant_id,
        product_name: it.product_name,
        variant_label: it.variant_label,
        unit_price: it.unit_price,
        qty: it.qty,
        options: preparedOptions,
      };
    });

    haptic("medium");
    updateOrder.mutate(
      {
        orderId,
        payload: {
          status,
          scheduled_time: scheduledTime || null,
          delivery_address: deliveryAddress,
          contact_name: contactName,
          contact_phone: contactPhone,
          comment: comment || null,
          items: preparedItems,
        },
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      }
    );
  };

  const handleNotify = () => {
    haptic("medium");
    notifyOrder.mutate(orderId, {
      onSuccess: () => {
        setNotified(true);
        hapticNotify("success");
        setTimeout(() => setNotified(false), 3000);
      },
    });
  };

  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  if (isPending) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain">
        <div
          className="rounded-2xl p-6 shadow-2xl"
          style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
        >
          <Spinner />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain">
        <div
          className="rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
        >
          <ErrorBox message={error?.message || "Замовлення не знайдено"} onRetry={onClose} />
        </div>
      </div>
    );
  }

  const filteredChoices = variantChoices.filter((vc) => {
    if (!dishSearch) return true;
    const q = dishSearch.toLowerCase();
    return (
      vc.product_name.toLowerCase().includes(q) ||
      vc.variant_label.toLowerCase().includes(q) ||
      (vc.category_name && vc.category_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4 overscroll-contain">
      <div
        className="w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-4 sm:max-w-lg space-y-4 overscroll-contain touch-pan-y shadow-2xl"
        style={{
          background: "var(--tg-theme-bg-color, #ffffff)",
          border: "1px solid var(--app-border)",
          color: "var(--tg-theme-text-color)",
        }}
      >
        {/* Заголовок */}
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div>
            <h3 className="text-base font-bold">Зміна замовлення #{order.id}</h3>
            <p className="text-xs opacity-60">
              {order.fulfillment_type === "delivery" ? "🛵 Доставка" : "🛍️ Самовивіз"} • 📅{" "}
              {order.created_at}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity">
            ✕
          </button>
        </div>

        {/* Примітка про клієнта */}
        {order.user_admin_note && (
          <div
            className="rounded-xl p-2.5 text-xs"
            style={{
              background: "color-mix(in srgb, #f59e0b 15%, transparent)",
              color: "#b45309",
            }}
          >
            ⚠️ <b>Примітка про клієнта:</b> {order.user_admin_note}
          </div>
        )}

        {/* Основні параметри */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block mb-1 font-semibold opacity-70">Статус замовлення:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-[var(--app-border)] p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
            >
              <option value="pending_moderation">⏳ Очікує підтвердження</option>
              <option value="confirmed">✅ Підтверджено</option>
              <option value="in_progress">👨‍🍳 Готується</option>
              <option value="ready">🛍️ Готове до видачі (самовивіз)</option>
              <option value="on_the_way">🛵 В дорозі (доставка)</option>
              <option value="completed">🏁 Виконано</option>
              <option value="rejected">❌ Відхилено</option>
              <option value="cancelled">🚫 Скасовано</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-semibold opacity-70">
              ⏰ Бажаний час (10:30-21:30):
            </label>
            <input
              type="time"
              value={scheduledTime}
              min="10:30"
              max="21:30"
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full rounded-xl border border-[var(--app-border)] p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
            />
          </div>
        </div>

        <div className="space-y-2 text-xs">
          {order.fulfillment_type === "delivery" && (
            <div>
              <label className="block mb-1 font-semibold opacity-70">Адреса доставки:</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full rounded-xl p-2.5 font-medium outline-none"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1 font-semibold opacity-70">Ім'я клієнта:</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-xl p-2.5 font-medium outline-none"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold opacity-70">Телефон:</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-xl p-2.5 font-medium outline-none"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 font-semibold opacity-70">Коментар:</label>
            <input
              type="text"
              value={comment}
              placeholder="Коментар клієнта або менеджера..."
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)" }}
            />
          </div>
        </div>

        {/* Блок страв та позицій */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
              Позиції замовлення ({items.length})
            </h4>
            <button
              onClick={() => {
                haptic("light");
                setAddDishOpen(true);
              }}
              className="app-press rounded-xl px-2.5 py-1 text-xs font-semibold"
              style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
            >
              + Додати страву
            </button>
          </div>

          <div className="space-y-2.5">
            {items.map((it, idx) => {
              const rules = getOptionRulesForDraft(it);
              const calc = calculateItemOptionsWithFreeQuota(
                it.options,
                rules,
                it.unit_price,
                it.qty
              );

              return (
                <div
                  key={idx}
                  className="rounded-2xl p-3 border space-y-2 text-xs"
                  style={{ borderColor: "var(--app-border)", background: "var(--app-surface-2)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{it.product_name}</p>
                      <p className="opacity-60 text-[11px]">
                        {it.variant_label} • {formatPrice(it.unit_price)}/шт
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-0.5">
                        <button
                          onClick={() => {
                            haptic("light");
                            if (it.qty > 1) {
                              const next = [...items];
                              next[idx].qty -= 1;
                              setItems(next);
                            }
                          }}
                          className="font-bold px-1"
                        >
                          -
                        </button>
                        <span className="font-bold px-1">{it.qty}</span>
                        <button
                          onClick={() => {
                            haptic("light");
                            const next = [...items];
                            next[idx].qty += 1;
                            setItems(next);
                          }}
                          className="font-bold px-1"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-bold min-w-[65px] text-right">
                        {formatPrice(calc.itemSubtotal)}
                      </span>

                      <button
                        onClick={() => {
                          haptic("light");
                          setItems(items.filter((_, i) => i !== idx));
                        }}
                        className="text-red-500 opacity-60 hover:opacity-100 p-1"
                        title="Видалити"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Додатки до цієї страви */}
                  {calc.breakdown.length > 0 && (
                    <div
                      className="space-y-1.5 pl-2.5 border-l-2 py-0.5"
                      style={{ borderColor: "var(--tg-theme-button-color)" }}
                    >
                      {calc.breakdown.map((b, bIdx) => (
                        <div
                          key={bIdx}
                          className="flex items-center justify-between text-[11px] opacity-80"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="truncate">
                              ↳ <b>{b.option_name}</b> {b.qty > 1 ? `×${b.qty}` : ""}
                              {b.freeQty > 0 && b.paidQty === 0 && (
                                <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  (включено, 0 ₴)
                                </span>
                              )}
                              {b.freeQty > 0 && b.paidQty > 0 && (
                                <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  ({b.freeQty} включено, {b.paidQty} платно)
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-semibold text-right min-w-[45px]">
                              {b.effectiveCost > 0 ? `+${formatPrice(b.effectiveCost)}` : "0 ₴"}
                            </span>

                            <div className="flex items-center gap-1 rounded bg-black/5 dark:bg-white/10 px-1 py-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  haptic("light");
                                  handleUpdateOptionQty(
                                    idx,
                                    b.option_group_name,
                                    b.option_name,
                                    -1
                                  );
                                }}
                                className="px-1 font-bold text-xs hover:text-red-500"
                                title="Зменшити кількість"
                              >
                                -
                              </button>
                              <span className="font-bold text-[10px] px-0.5">{b.qty}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  haptic("light");
                                  handleUpdateOptionQty(
                                    idx,
                                    b.option_group_name,
                                    b.option_name,
                                    1
                                  );
                                }}
                                className="px-1 font-bold text-xs hover:text-emerald-500"
                                title="Збільшити кількість"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                haptic("light");
                                handleRemoveOption(idx, b.option_group_name, b.option_name);
                              }}
                              className="text-red-500 opacity-60 hover:opacity-100 px-1"
                              title="Видалити додаток"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      haptic("light");
                      setTargetItemIdx(idx);
                    }}
                    className="text-[11px] font-semibold opacity-75 hover:opacity-100 text-blue-500 inline-flex items-center gap-1"
                  >
                    <span>+ Додати опцію / соус до страви</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Підсумок */}
        <div
          className="flex items-center justify-between border-t pt-3"
          style={{ borderColor: "var(--app-border)" }}
        >
          <span className="text-sm font-bold">Разом до сплати:</span>
          <span className="text-lg font-bold" style={{ color: "var(--tg-theme-button-color)" }}>
            {formatPrice(calculatedTotal)}
          </span>
        </div>

        {/* Кнопки збереження та сповіщення */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleSave}
            disabled={updateOrder.isPending}
            className="app-press w-full rounded-xl py-3 text-sm font-bold shadow-sm"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            {updateOrder.isPending ? "Збереження..." : "💾 Зберегти зміни"}
          </button>

          <button
            onClick={handleNotify}
            disabled={notifyOrder.isPending || notified}
            className="app-press w-full rounded-xl py-2.5 text-xs font-semibold border"
            style={{ borderColor: "var(--app-border)" }}
          >
            {notified
              ? "✅ Сповіщення надіслано в Telegram!"
              : notifyOrder.isPending
              ? "Надсилання..."
              : "💬 Надіслати оновлений чек клієнту в Telegram"}
          </button>
        </div>

        {/* Модалка вибору страви для додавання */}
        {addDishOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 overscroll-contain">
            <div
              className="w-full max-h-[85dvh] overflow-y-auto rounded-2xl p-4 max-w-sm space-y-3 overscroll-contain touch-pan-y shadow-2xl"
              style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">Додати страву до замовлення</h4>
                <button
                  onClick={() => setAddDishOpen(false)}
                  className="opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                placeholder="🔍 Пошук страви..."
                value={dishSearch}
                onChange={(e) => setDishSearch(e.target.value)}
                className="w-full rounded-xl p-2.5 text-xs outline-none"
                style={{ background: "var(--app-surface-2)" }}
              />

              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {filteredChoices.slice(0, 40).map((vc) => (
                  <button
                    key={vc.variant_id}
                    onClick={() => {
                      haptic("light");
                      setItems([
                        ...items,
                        {
                          variant_id: vc.variant_id,
                          product_id: vc.product_id,
                          product_name: vc.product_name,
                          variant_label: vc.variant_label,
                          unit_price: vc.price,
                          qty: 1,
                          options: [],
                        },
                      ]);
                      setAddDishOpen(false);
                      setDishSearch("");
                    }}
                    className="app-press flex w-full items-center justify-between rounded-xl p-2 text-left text-xs hover:bg-black/5"
                    style={{ background: "var(--app-surface-2)" }}
                  >
                    <div>
                      <p className="font-bold">{vc.product_name}</p>
                      <p className="opacity-60 text-[10px]">
                        {vc.category_name ? `${vc.category_name} • ` : ""}
                        {vc.variant_label}
                      </p>
                    </div>
                    <span className="font-bold">{formatPrice(vc.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Модалка додавання опції: прив'язані, з меню або власні */}
        {targetItemIdx !== null && items[targetItemIdx] && (
          <AddOptionToItemModal
            item={items[targetItemIdx]}
            productId={
              items[targetItemIdx].product_id ??
              getProductForDraft(items[targetItemIdx])?.id ??
              null
            }
            adminOptionGroups={adminOptionGroups}
            onAddOption={(groupName, optName, priceDelta) => {
              handleAddOptionToItem(targetItemIdx, groupName, optName, priceDelta);
            }}
            onClose={() => setTargetItemIdx(null)}
          />
        )}
      </div>
    </div>
  );
}
