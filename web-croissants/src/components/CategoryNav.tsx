import { useEffect, useMemo, useRef } from "react";
import type { Category, ProductListItem } from "../types/catalog.ts";

interface CategoryNavProps {
  categories: Category[];
  selectedCategoryId: number | "all";
  activeNavId: string | number | null;
  activeSubcategoryId?: number | null;
  onSelectCategory: (id: number | "all") => void;
  onSelectNav: (id: string | number) => void;
  onSelectSubcategory: (subcatId: number | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  productsByCategory?: Record<number, ProductListItem[]>;
}

export function CategoryNav({
  categories,
  selectedCategoryId,
  activeNavId,
  activeSubcategoryId = null,
  onSelectCategory,
  onSelectNav,
  onSelectSubcategory,
  searchQuery,
  onSearchChange,
  productsByCategory = {},
}: CategoryNavProps) {
  const rootCategories = categories.filter((c) => c.parent_id === null);
  const navRef = useRef<HTMLDivElement>(null);
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const subcategoriesScrollRef = useRef<HTMLDivElement>(null);

  const isInfoActive =
    typeof activeNavId === "string" &&
    ["about", "delivery", "careers", "contacts"].includes(activeNavId);

  // Вимірюємо точну динамічну висоту навігаційної плашки
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const updateHeight = () => {
      const height = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--category-nav-height",
        `${Math.round(height)}px`,
      );
    };

    updateHeight();

    const ro = new ResizeObserver(() => {
      updateHeight();
    });
    ro.observe(el);

    window.addEventListener("resize", updateHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [selectedCategoryId, activeNavId]);

  // Автоматичне центрування активної категорії при кліку або зміні
  useEffect(() => {
    if (!categoriesScrollRef.current || searchQuery) return;
    const targetKey = String(activeNavId ?? selectedCategoryId);
    const activeBtn = categoriesScrollRef.current.querySelector<HTMLElement>(
      `[data-category-id="${targetKey}"]`,
    );
    if (!activeBtn) return;
    const container = categoriesScrollRef.current;
    const pillLeft = activeBtn.offsetLeft;
    const pillWidth = activeBtn.offsetWidth;
    const containerWidth = container.offsetWidth;
    container.scrollTo({
      left: pillLeft - containerWidth / 2 + pillWidth / 2,
      behavior: "smooth",
    });
  }, [activeNavId, selectedCategoryId, searchQuery]);

  // Автоматичне центрування активної підкатегорії
  useEffect(() => {
    if (!subcategoriesScrollRef.current || searchQuery) return;
    const targetKey = activeSubcategoryId === null ? "all" : String(activeSubcategoryId);
    const activeBtn = subcategoriesScrollRef.current.querySelector<HTMLElement>(
      `[data-subcategory-id="${targetKey}"]`,
    );
    if (!activeBtn) return;
    const container = subcategoriesScrollRef.current;
    const pillLeft = activeBtn.offsetLeft;
    const pillWidth = activeBtn.offsetWidth;
    const containerWidth = container.offsetWidth;
    container.scrollTo({
      left: pillLeft - containerWidth / 2 + pillWidth / 2,
      behavior: "smooth",
    });
  }, [activeSubcategoryId, searchQuery]);

  // Визначаємо підкатегорії для поточної вибраної категорії
  const currentRootId =
    typeof selectedCategoryId === "number"
      ? selectedCategoryId
      : typeof activeNavId === "number"
      ? activeNavId
      : rootCategories[0]?.id;

  const activeRootCategory = rootCategories.find((c) => c.id === currentRootId);

  const activeSubcategories = activeRootCategory
    ? categories
        .filter((c) => c.parent_id === activeRootCategory.id)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const activeCategoryItems = activeRootCategory
    ? productsByCategory[activeRootCategory.id] || []
    : [];

  const subcategoryCounts = useMemo(() => {
    return activeSubcategories.reduce<Record<number, number>>((acc, sub) => {
      acc[sub.id] = activeCategoryItems.filter(
        (p) =>
          p.category_id === sub.id ||
          p.category_name?.trim().toLowerCase() === sub.name.trim().toLowerCase(),
      ).length;
      return acc;
    }, {});
  }, [activeSubcategories, activeCategoryItems]);

  return (
    <div
      ref={navRef}
      data-category-nav="true"
      className="sticky z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#EADFCF] py-2.5 sm:py-3 shadow-xs space-y-2"
      style={{ top: "var(--header-height, 96px)" }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-2">
        {/* Рядок 1: Пошук та головні категорії меню */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
          {/* Поле швидкого пошуку */}
          <div className="relative w-full sm:w-64 md:w-72 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8D7B6D] pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Пошук круасанів, кави..."
              className="w-full bg-white border border-[#E2D5C3] rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-[#2C1E14] placeholder:text-[#A8988B] focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30 focus:border-[#C8823E] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                title="Очистити пошук"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8D7B6D] hover:text-[#2C1E14] text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Горизонтальний ряд категорій меню з перемиканням вкладок */}
          <div
            ref={categoriesScrollRef}
            className="flex-1 min-w-0 relative flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar"
          >
            {/* Категорії страв каталогу */}
            {rootCategories.map((cat) => {
              const isSelected =
                !searchQuery &&
                !isInfoActive &&
                (selectedCategoryId === cat.id ||
                  (selectedCategoryId === "all" && activeNavId === cat.id));
              return (
                <button
                  key={cat.id}
                  data-category-id={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#C8823E] text-white shadow-md shadow-[#C8823E]/25 scale-[1.02]"
                      : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
                  }`}
                >
                  {cat.icon && <span className="text-sm sm:text-base">{cat.icon}</span>}
                  <span>{cat.name}</span>
                </button>
              );
            })}

            {/* Всі категорії (Повне меню) */}
            <button
              data-category-id="all"
              type="button"
              onClick={() => onSelectCategory("all")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && !isInfoActive && selectedCategoryId === "all"
                  ? "bg-[#2C1E14] text-white shadow-md scale-[1.02]"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>🍽️</span>
              <span>Все меню</span>
            </button>

            {/* Розділювач */}
            <div className="h-5 w-px bg-[#E2D5C3] mx-1 shrink-0" />

            {/* Інформаційні секції сайту */}
            <button
              data-category-id="about"
              type="button"
              onClick={() => onSelectNav("about")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "about"
                  ? "bg-[#2C1E14] text-white shadow-md"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>ℹ️</span>
              <span>Про нас</span>
            </button>
            <button
              data-category-id="delivery"
              type="button"
              onClick={() => onSelectNav("delivery")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "delivery"
                  ? "bg-[#2C1E14] text-white shadow-md"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>🛵</span>
              <span>Доставка</span>
            </button>
            <button
              data-category-id="careers"
              type="button"
              onClick={() => onSelectNav("careers")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "careers"
                  ? "bg-[#2C1E14] text-white shadow-md"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>💼</span>
              <span>Вакансії</span>
            </button>
            <button
              data-category-id="contacts"
              type="button"
              onClick={() => onSelectNav("contacts")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "contacts"
                  ? "bg-[#2C1E14] text-white shadow-md"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>📍</span>
              <span>Контакти</span>
            </button>
          </div>
        </div>

        {/* Рядок 2: Підкатегорії поточної активної категорії */}
        {!searchQuery && !isInfoActive && activeSubcategories.length > 0 && activeRootCategory && (
          <div className="pt-1 border-t border-[#EADFCF]/60 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8D7B6D] shrink-0 hidden md:inline">
              Підкатегорії:
            </span>
            <div
              ref={subcategoriesScrollRef}
              className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar"
            >
              {/* Кнопка «Всі» для поточної категорії */}
              <button
                data-subcategory-id="all"
                type="button"
                onClick={() => onSelectSubcategory(null)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs whitespace-nowrap transition-all cursor-pointer ${
                  activeSubcategoryId === null
                    ? "bg-[#2C1E14] text-white shadow-xs font-bold"
                    : "bg-[#F3EDE2] hover:bg-[#EADFCF] text-[#4A3B32] font-medium"
                }`}
              >
                Всі ({activeCategoryItems.length})
              </button>

              {/* Список підкатегорій */}
              {activeSubcategories.map((sub) => {
                const count = subcategoryCounts[sub.id] || 0;
                if (count === 0) return null;
                const isSelected = activeSubcategoryId === sub.id;

                return (
                  <button
                    key={sub.id}
                    data-subcategory-id={sub.id}
                    type="button"
                    onClick={() => onSelectSubcategory(sub.id)}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#C8823E] text-white shadow-xs font-bold scale-[1.02]"
                        : "bg-[#F3EDE2] hover:bg-[#EADFCF] text-[#4A3B32] font-medium"
                    }`}
                  >
                    <span>{sub.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isSelected
                          ? "bg-white/25 text-white"
                          : "bg-white/90 text-[#6B533E]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
