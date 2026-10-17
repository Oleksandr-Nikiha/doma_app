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
        <div className="bg-[#181B22] rounded-2xl p-4 sm:p-5 border border-white/10 flex items-center justify-between gap-4 shadow-md">
          <div>
            <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
              Результати пошуку
            </div>
            <div className="text-base sm:text-lg font-bold text-[#F1F5F9] mt-0.5">
              За запитом «{searchQuery}» знайдено:{" "}
              <span className="text-[#E2583E] font-extrabold">
                {totalSearchResults}{" "}
                {totalSearchResults === 1 ? "страву" : "позицій"}
              </span>
            </div>
          </div>
          <button
            onClick={onClearSearch}
            type="button"
            className="text-xs sm:text-sm font-bold bg-[#222731] hover:bg-[#2A313E] text-[#F1F5F9] px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 border border-white/10"
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
              className="bg-[#181B22] rounded-2xl border border-white/10 overflow-hidden p-3 sm:p-4 space-y-2.5 sm:space-y-3 animate-pulse"
            >
              <div className="aspect-[4/3] bg-[#242934] rounded-xl w-full"></div>
              <div className="h-4 sm:h-5 bg-[#242934] rounded-md w-3/4"></div>
              <div className="h-3 sm:h-4 bg-[#242934] rounded-md w-1/2"></div>
              <div className="h-7 sm:h-8 bg-[#242934] rounded-xl w-full mt-2 sm:mt-4"></div>
            </div>
          ))}
        </div>
      ) : normalizedSearch && totalSearchResults === 0 ? (
        <div className="bg-[#181B22] rounded-3xl p-8 sm:p-14 text-center border border-white/10 space-y-4 max-w-lg mx-auto shadow-xl">
          <div className="text-5xl">🍕🔍</div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
            Нічого не знайдено за запитом «{searchQuery}»
          </h3>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            Спробуйте змінити пошукове слово або переглянути всі категорії нашого свіжого меню
          </p>
          <button
            type="button"
            onClick={onClearSearch}
            className="bg-[#D34528] hover:bg-[#B34B24] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Показати повне меню
          </button>
        </div>
      ) : (
        categories.map((category) => {
          const items = productsByCategory[category.id] || [];
          if (items.length === 0) return null;

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
              <div className="space-y-3 border-b-2 border-white/10 pb-3 sm:pb-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {category.icon && (
                      <span className="text-2xl sm:text-4xl">{category.icon}</span>
                    )}
                    <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
                      {category.name}
                    </h2>
                  </div>
                  <div className="text-xs font-semibold text-[#94A3B8] bg-[#1E232B] border border-white/10 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full">
                    {items.length} {items.length === 1 ? "страва" : "позицій"}
                  </div>
                </div>

                {/* Швидкі мітки підкатегорій всередині категорії */}
                {subcategories.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar pt-1">
                    {subcategories.map((subcat) => {
                      const subcatCount = items.filter(
                        (p) =>
                          p.category_id === subcat.id ||
                          p.category_name?.trim().toLowerCase() === subcat.name.trim().toLowerCase(),
                      ).length;
                      if (subcatCount === 0) return null;
                      return (
                        <button
                          key={subcat.id}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`subcategory-${subcat.id}`);
                            if (el) {
                              const navEl = document.querySelector("[data-category-nav]");
                              const headerEl = document.querySelector("header");
                              const offset = (headerEl?.clientHeight || 96) + (navEl?.clientHeight || 56) + 16;
                              const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset);
                              window.scrollTo({ top: y, behavior: "smooth" });
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E232B] hover:bg-[#272D37] text-[#CBD5E1] border border-white/10 transition-colors cursor-pointer shrink-0"
                        >
                          <span>{subcat.name}</span>
                          <span className="text-[10px] bg-[#121417] text-[#94A3B8] px-1.5 py-0.2 rounded-full font-bold">
                            {subcatCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {subcategories.length > 0 ? (
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
                        <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-white/10">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#D34528] shrink-0" />
                            <h3 className="font-display text-lg sm:text-2xl font-bold text-white">
                              {subcat.name}
                            </h3>
                          </div>
                          <span className="text-xs font-semibold text-[#94A3B8] bg-[#1E232B] border border-white/10 px-2.5 py-0.5 rounded-full">
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
                        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                          <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                          <h3 className="font-display text-lg font-bold text-white">
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
