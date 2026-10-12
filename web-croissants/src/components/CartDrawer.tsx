import { getImageUrl } from "../api/client.ts";
import { useCart } from "../context/CartContext.tsx";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCheckout: () => void;
  isAuthenticated?: boolean;
}

export function CartDrawer({
  isOpen,
  onClose,
  onOpenCheckout,
  isAuthenticated = false,
}: CartDrawerProps) {
  const { items, totalQty, totalPrice, updateQty, removeItem, clearCart } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Клік по фону для закриття */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white h-full flex flex-col shadow-2xl z-10 border-l border-[#E8DFC8] animate-in slide-in-from-right duration-300">
        {/* Хедер кошика */}
        <div className="p-5 border-b border-[#EADFCF] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛍️</span>
            <div>
              <h2 className="font-display text-xl font-bold text-[#2C1E14]">Ваш кошик</h2>
              <p className="text-xs text-[#7A695C]">
                {totalQty > 0 ? `${totalQty} позицій у кошику` : "Поки що порожньо"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-full bg-white hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#E2D5C3] flex items-center justify-center font-bold text-sm transition-transform active:scale-95 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Список страв */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-[#7A695C]">
              <div className="w-20 h-20 rounded-full bg-[#FAF7F2] border border-[#E8DFC8] flex items-center justify-center text-4xl shadow-inner">
                🥐
              </div>
              <div className="space-y-1">
                <p className="font-display text-lg font-bold text-[#2C1E14]">
                  Кошик порожній
                </p>
                <p className="text-xs max-w-xs text-[#8D7B6D]">
                  Оберіть хрусткі круасани, ароматну каву або бенто-піцу у меню нижче
                </p>
              </div>
              <button
                onClick={onClose}
                type="button"
                className="bg-[#C8823E] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                До меню
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl border border-[#EADFCF] bg-[#FAF7F2]/60 hover:bg-[#FAF7F2] transition-colors space-y-3"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={getImageUrl(item.imageUrl)}
                    alt={item.productName}
                    className="w-16 h-16 rounded-xl object-cover bg-[#F3EDE2] border border-[#EADFCF]"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-[#2C1E14] truncate">
                      {item.productName}
                    </h4>
                    <div className="text-xs text-[#8D7B6D] mt-0.5">
                      {item.variant.label}
                      {item.variant.weight && ` (${item.variant.weight} г)`}
                    </div>
                    {item.selectedOptions.length > 0 && (
                      <div className="text-[11px] text-[#A06C3E] mt-1 line-clamp-2">
                        + {item.selectedOptions.map((o) => o.option.name).join(", ")}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    type="button"
                    title="Видалити"
                    className="text-[#A8988B] hover:text-red-600 transition-colors text-xs p-1"
                  >
                    🗑️
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#EFE7D8]">
                  <div className="flex items-center gap-2 bg-white rounded-xl border border-[#EADFCF] p-1">
                    <button
                      onClick={() => updateQty(item.id, item.qty - 1)}
                      type="button"
                      className="w-6 h-6 rounded-lg text-xs font-bold text-[#2C1E14] hover:bg-[#F3EDE2] flex items-center justify-center cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-[#2C1E14]">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      type="button"
                      className="w-6 h-6 rounded-lg text-xs font-bold text-[#2C1E14] hover:bg-[#F3EDE2] flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-sm text-[#2C1E14]">
                      {item.itemSubtotal} ₴
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Футер кошика з кнопкою чекауту */}
        {items.length > 0 && (
          <div className="p-5 border-t border-[#EADFCF] bg-[#FAF7F2] space-y-4">
            {/* Підказка щодо безкоштовної доставки */}
            <div
              className={`rounded-2xl p-3.5 border transition-all ${
                totalPrice >= 250
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                  : "bg-white border-[#E8DFC8] text-[#614F42]"
              } space-y-2`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  {totalPrice >= 250 ? (
                    <>
                      <span className="text-sm">🎉</span>
                      <span>Безкоштовна доставка по Вишгороду активна!</span>
                    </>
                  ) : (
                    <>
                      <span>🛵</span>
                      <span>
                        Додайте ще на{" "}
                        <strong className="text-[#C8823E] font-extrabold">
                          {250 - totalPrice} ₴
                        </strong>{" "}
                        для безкоштовної доставки
                      </span>
                    </>
                  )}
                </span>
                <span
                  className={`text-[11px] font-extrabold ${
                    totalPrice >= 250 ? "text-emerald-700" : "text-[#C8823E]"
                  }`}
                >
                  {Math.min(100, Math.round((totalPrice / 250) * 100))}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#EADFCF]/70 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    totalPrice >= 250
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-[#E29E57] to-[#C8823E]"
                  }`}
                  style={{ width: `${Math.min(100, (totalPrice / 250) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B533E] font-medium">Сума замовлення:</span>
              <span className="font-extrabold text-xl text-[#2C1E14]">
                {totalPrice} ₴
              </span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenCheckout();
                }}
                type="button"
                className="w-full bg-[#C8823E] hover:bg-[#B36F2D] text-white py-3.5 px-4 rounded-2xl font-bold text-base shadow-lg shadow-[#C8823E]/20 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{isAuthenticated ? "Оформити замовлення" : "Увійти та оформити"}</span>
                <span>→</span>
              </button>

              {!isAuthenticated && (
                <p className="text-[11px] text-center text-[#8D7B6D] flex items-center justify-center gap-1.5 pt-0.5">
                  <span>🔒</span>
                  <span>Оформлення замовлення доступне після швидкої авторизації</span>
                </p>
              )}

              <button
                onClick={clearCart}
                type="button"
                className="w-full text-xs text-[#8D7B6D] hover:text-red-600 transition-colors py-1 cursor-pointer"
              >
                Очистити весь кошик
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

