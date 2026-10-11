import { useEffect, useState } from "react";
import { fetchProductDetail, getImageUrl } from "../api/client.ts";
import { useCart } from "../context/CartContext.tsx";
import type { SelectedOptionWithGroup } from "../types/cart.ts";
import type { ProductDetail, ProductOptionItem, ProductVariant } from "../types/catalog.ts";

interface ProductModalProps {
  productId: number;
  onClose: () => void;
}

export function ProductModal({ productId, onClose }: ProductModalProps) {
  const { addItem } = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptionWithGroup[]>([]);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchProductDetail(productId)
      .then((data) => {
        if (!isMounted) return;
        setProduct(data);
        if (data.variants.length > 0) {
          setSelectedVariant(data.variants[0]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Помилка завантаження страви");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#C8823E] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-[#6B533E]">Завантажуємо смаколики...</p>
        </div>
      </div>
    );
  }

  if (error || !product || !selectedVariant) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
          <p className="text-red-600 font-bold">{error || "Страву не знайдено"}</p>
          <button
            onClick={onClose}
            type="button"
            className="w-full bg-[#2C1E14] text-white py-2.5 rounded-xl font-bold"
          >
            Закрити
          </button>
        </div>
      </div>
    );
  }

  // Розрахунок опцій з урахуванням безкоштовної квоти (free_count)
  let extraOptionsCostPerUnit = 0;
  product.option_groups.forEach((group) => {
    const chosenInGroup = selectedOptions.filter((o) => o.groupId === group.group_id);
    const deltas = chosenInGroup.map((o) => o.option.price_delta).sort((a, b) => b - a);
    const charged = deltas.slice(group.free_count);
    const sum = charged.reduce((acc, d) => acc + d, 0);
    extraOptionsCostPerUnit += sum;
  });

  const unitTotal = selectedVariant.price + extraOptionsCostPerUnit;
  const totalPrice = unitTotal * qty;

  const handleToggleOption = (
    groupId: number,
    groupName: string,
    option: ProductOptionItem,
    maxSelect: number,
  ) => {
    setSelectedOptions((prev) => {
      const alreadyIndex = prev.findIndex(
        (o) => o.groupId === groupId && o.option.variant_id === option.variant_id,
      );

      if (alreadyIndex > -1) {
        return prev.filter((_, idx) => idx !== alreadyIndex);
      }

      const inGroup = prev.filter((o) => o.groupId === groupId);
      if (maxSelect === 1) {
        // Замінюємо попередній вибір у групі
        const otherGroups = prev.filter((o) => o.groupId !== groupId);
        return [...otherGroups, { groupId, groupName, option }];
      }

      if (inGroup.length >= maxSelect) {
        return prev;
      }

      return [...prev, { groupId, groupName, option }];
    });
  };

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.image_url,
      variant: selectedVariant,
      selectedOptions,
      qty,
      extraPerUnit: extraOptionsCostPerUnit,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#E8DFC8] animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        {/* Кнопка закриття */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Закрити"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 backdrop-blur-md text-[#2C1E14] hover:bg-white flex items-center justify-center font-bold text-lg sm:text-xl shadow-md cursor-pointer transition-transform hover:scale-110 active:scale-95"
        >
          ✕
        </button>

        {/* Скролабельний вміст модального вікна */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Зображення */}
          <div className="relative aspect-[16/9] w-full bg-[#F3EDE2] overflow-hidden">
            <img
              src={getImageUrl(product.image_url)}
              alt={product.name}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1200&q=80";
              }}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Тіло з опціями */}
          <div className="p-5 sm:p-8 space-y-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#2C1E14]">
                {product.name}
              </h2>
            {product.description && (
              <p className="mt-2 text-sm sm:text-base text-[#614F42] leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          {/* Вибір варіанту / розміру */}
          {product.variants.length > 1 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7A695C]">
                Оберіть розмір / варіант
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant.id === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      type="button"
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-[#C8823E] bg-[#FFF8EE] shadow-sm ring-2 ring-[#C8823E]/20"
                          : "border-[#EADFCF] hover:border-[#C8823E]/50 bg-white"
                      }`}
                    >
                      <div className="font-bold text-sm text-[#2C1E14]">{v.label}</div>
                      <div className="flex items-center justify-between text-xs text-[#7A695C] mt-1">
                        {v.weight && <span>{v.weight} г</span>}
                        <span className="font-extrabold text-[#C8823E]">{v.price} ₴</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Групи опцій / додатків */}
          {product.option_groups.map((group) => {
            return (
              <div key={group.group_id} className="space-y-3 pt-3 border-t border-[#F5EFE6]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-[#2C1E14]">{group.name}</span>
                    {group.free_count > 0 && (
                      <span className="ml-2 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                        {group.free_count} безкоштовно
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#8C7665]">
                    {group.max_select === 1
                      ? "Оберіть 1"
                      : `до ${group.max_select} шт`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.items.map((opt) => {
                    const isChecked = selectedOptions.some(
                      (o) =>
                        o.groupId === group.group_id && o.option.variant_id === opt.variant_id,
                    );
                    return (
                      <button
                        key={opt.variant_id}
                        onClick={() =>
                          handleToggleOption(
                            group.group_id,
                            group.name,
                            opt,
                            group.max_select,
                          )
                        }
                        type="button"
                        className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all cursor-pointer ${
                          isChecked
                            ? "border-[#C8823E] bg-[#FFF8EE] font-bold text-[#2C1E14]"
                            : "border-[#EADFCF] hover:border-[#C8823E]/40 text-[#4A3B32] bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center border text-[10px] ${
                              isChecked
                                ? "bg-[#C8823E] border-[#C8823E] text-white"
                                : "border-[#C4B29E]"
                            }`}
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span>{opt.name}</span>
                        </div>
                        {opt.price_delta > 0 && (
                          <span className="text-xs text-[#8C7665]">+{opt.price_delta} ₴</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Зафіксований футер із кількістю та кнопкою додавання */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-[#EADFCF] bg-[#FAF7F2] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-[#F3EDE2] rounded-2xl p-1 shrink-0">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-[#2C1E14] font-bold hover:bg-[#FAF7F2] shadow-xs flex items-center justify-center cursor-pointer active:scale-95 text-base sm:text-lg"
            >
              −
            </button>
            <span className="w-6 sm:w-8 text-center font-extrabold text-sm sm:text-base text-[#2C1E14]">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => q + 1)}
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-[#2C1E14] font-bold hover:bg-[#FAF7F2] shadow-xs flex items-center justify-center cursor-pointer active:scale-95 text-base sm:text-lg"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            type="button"
            className="flex-1 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-3 sm:py-3.5 px-4 sm:px-6 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-[#2C1E14]/15 transition-all active:scale-98 cursor-pointer flex items-center justify-between"
          >
            <span>В кошик</span>
            <span className="text-[#E29E57] font-extrabold">{totalPrice} ₴</span>
          </button>
        </div>
      </div>
    </div>
  );
}

