import { ProductCard } from "../ProductCard.tsx";
import type { Category, ProductListItem } from "../../types/catalog.ts";

interface MenuSectionProps {
  categories: Category[]; // Категорії для відображення (одна вибрана або всі при 'all' / пошуку)
  allCategories: Category[]; // Повний список категорій для підкатегорій
  productsByCategory: Record<number, ProductListItem[]>;
  loading: boolean;
  searchQuery: string;
  totalSearchResults: number;
  onClearSearch: () => void;
  onSelectProduct: (productId: number) => void;
}

export function MenuSection({
  categories,
  allCategories,
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
      className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-12 sm:space-y-16 min-h-[75vh]"
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
              <span className="text-[#C85A32] font-extrabold">
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
          <div className="text-5xl">🍕🔍</div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2C1E14]">
            Нічого не знайдено за запитом «{searchQuery}»
          </h3>
          <p className="text-sm text-[#7A695C] leading-relaxed">
            Спробуйте змінити пошукове слово або переглянути всі категорії нашого свіжого меню
          </p>
          <button
            type="button"
            onClick={onClearSearch}
            className="bg-[#C85A32] hover:bg-[#B34B24] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Показати повне меню
          </button>
        </div>
      ) : (
        categories.map((category) => {
          const items = productsByCategory[category.id] || [];
          if (items.length === 0 && normalizedSearch) return null;

          // Шукаємо підкатегорії для поточної кореневої категорії
          const subcategories = allCategories
            .filter((c) => c.parent_id === category.id)
            .sort((a, b) => a.sort_order - b.sort_order);

          return (
            <section
              key={category.id}
              id={`category-${category.id}`}
              className="space-y-6 sm:space-y-8 animate-in fade-in duration-200"
              style={{
                scrollMarginTop:
                  "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 20px)",
              }}
            >
              {/* Головна шапка кореневої категорії */}
              <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[#EADFCF] pb-3 sm:pb-4">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {category.icon && (
                    <span className="text-2xl sm:text-4xl">{category.icon}</span>
                  )}
                  <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-[#2C1E14]">
                    {category.name}
                  </h2>
                </div>
                <div className="text-xs font-semibold text-[#8D7B6D] bg-[#F3EDE2] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full">
                  {items.length} {items.length === 1 ? "страва" : "позицій"}
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-[#7A695C] italic">Позиції готуються до публікації...</p>
              ) : subcategories.length > 0 ? (
                /* Розбиття по підкатегоріях */
                <div className="space-y-8 sm:space-y-10">
                  {subcategories.map((subcat) => {
                    const subcatItems = items.filter(
                      (p) =>
                        p.category_id === subcat.id ||
                        p.category_name?.trim().toLowerCase() === subcat.name.trim().toLowerCase(),
                    );

                    if (subcatItems.length === 0) return null;

                    return (
                      <div
                        key={subcat.id}
                        id={`subcategory-${subcat.id}`}
                        className="space-y-4 pt-1 sm:pt-2"
                        style={{
                          scrollMarginTop:
                            "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 24px)",
                        }}
                      >
                        {/* Заголовок підкатегорії */}
                        <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#EADFCF]/80">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#C85A32] shrink-0" />
                            <h3 className="font-display text-lg sm:text-2xl font-bold text-[#2C1E14]">
                              {subcat.name}
                            </h3>
                          </div>
                          <span className="text-xs font-semibold text-[#8D7B6D] bg-[#F3EDE2] px-2.5 py-0.5 rounded-full">
                            {subcatItems.length} {subcatItems.length === 1 ? "страва" : "позицій"}
                          </span>
                        </div>

                        {/* Сітка товарів підкатегорії */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                          {subcatItems.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              onSelect={(id) => onSelectProduct(id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Позиції без прив'язки до відомих підкатегорій (якщо є) */}
                  {(() => {
                    const orphanItems = items.filter(
                      (p) =>
                        !subcategories.some(
                          (sub) =>
                            sub.id === p.category_id ||
                            sub.name.trim().toLowerCase() === p.category_name?.trim().toLowerCase(),
                        ),
                    );

                    if (orphanItems.length === 0) return null;

                    return (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2 pb-2 border-b border-[#EADFCF]">
                          <span className="w-2 h-2 rounded-full bg-[#8D7B6D]" />
                          <h3 className="font-display text-lg font-bold text-[#2C1E14]">
                            Інші позиції
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                          {orphanItems.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              onSelect={(id) => onSelectProduct(id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Для категорій без підкатегорій — пряма сітка */
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
