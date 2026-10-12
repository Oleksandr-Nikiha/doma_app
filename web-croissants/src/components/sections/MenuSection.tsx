import { ProductCard } from "../ProductCard.tsx";
import type { Category, ProductListItem } from "../../types/catalog.ts";

interface MenuSectionProps {
  categories: Category[];
  productsByCategory: Record<number, ProductListItem[]>;
  loading: boolean;
  searchQuery: string;
  totalSearchResults: number;
  onClearSearch: () => void;
  onSelectProduct: (productId: number) => void;
}

export function MenuSection({
  categories,
  productsByCategory,
  loading,
  searchQuery,
  totalSearchResults,
  onClearSearch,
  onSelectProduct,
}: MenuSectionProps) {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return (
    <main
      id="menu"
      className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16"
      style={{
        scrollMarginTop:
          "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
      }}
    >
      {/* Панель результатів пошуку */}
      {normalizedSearch && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8DFC8] flex items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="text-xs font-bold text-[#8D7B6D] uppercase tracking-wider">
              Результати пошуку
            </div>
            <div className="text-base sm:text-lg font-bold text-[#2C1E14] mt-0.5">
              За запитом «{searchQuery}» знайдено:{" "}
              <span className="text-[#C8823E] font-extrabold">
                {totalSearchResults}{" "}
                {totalSearchResults === 1 ? "страву" : "позицій"}
              </span>
            </div>
          </div>
          <button
            onClick={onClearSearch}
            type="button"
            className="text-xs sm:text-sm font-bold bg-[#F3EDE2] hover:bg-[#EADFCF] text-[#4A3B32] px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            ✕ Очистити пошук
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl border border-[#E8DFC8] overflow-hidden p-3 sm:p-4 space-y-2.5 sm:space-y-3 animate-pulse"
            >
              <div className="aspect-[4/3] bg-[#EADFCF] rounded-xl w-full"></div>
              <div className="h-4 sm:h-5 bg-[#EADFCF] rounded-md w-3/4"></div>
              <div className="h-3 sm:h-4 bg-[#EADFCF] rounded-md w-1/2"></div>
              <div className="h-7 sm:h-8 bg-[#EADFCF] rounded-xl w-full mt-2 sm:mt-4"></div>
            </div>
          ))}
        </div>
      ) : normalizedSearch && totalSearchResults === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-14 text-center border border-[#E8DFC8] space-y-4 max-w-lg mx-auto shadow-xs">
          <div className="text-5xl">🥐🔍</div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2C1E14]">
            Нічого не знайдено за запитом «{searchQuery}»
          </h3>
          <p className="text-sm text-[#7A695C] leading-relaxed">
            Спробуйте змінити пошукове слово або переглянути всі категорії нашого свіжого меню
          </p>
          <button
            type="button"
            onClick={onClearSearch}
            className="bg-[#C8823E] hover:bg-[#B36F2D] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Показати повне меню
          </button>
        </div>
      ) : (
        categories.map((category) => {
          const items = productsByCategory[category.id] || [];
          return (
            <section
              key={category.id}
              id={`category-${category.id}`}
              className="space-y-4 sm:space-y-6"
              style={{
                scrollMarginTop:
                  "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
              }}
            >
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#EADFCF] pb-3 sm:pb-4">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {category.icon && (
                    <span className="text-2xl sm:text-4xl">{category.icon}</span>
                  )}
                  <h2 className="font-display text-xl sm:text-3xl font-extrabold text-[#2C1E14]">
                    {category.name}
                  </h2>
                </div>
                <div className="text-xs font-semibold text-[#8D7B6D] bg-[#F3EDE2] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full">
                  {items.length} {items.length === 1 ? "страва" : "позицій"}
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-[#7A695C] italic">Позиції готуються до публікації...</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {items.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelect={(id) => onSelectProduct(id)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}

