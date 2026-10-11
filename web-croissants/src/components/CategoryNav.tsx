import { useEffect, useRef } from "react";
import type { Category } from "../types/catalog.ts";

interface CategoryNavProps {
  categories: Category[];
  activeNavId: string | number | null;
  onSelectNav: (id: string | number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function CategoryNav({
  categories,
  activeNavId,
  onSelectNav,
  searchQuery,
  onSearchChange,
}: CategoryNavProps) {
  const rootCategories = categories.filter((c) => c.parent_id === null);
  const navRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  }, []);

  // Автоматичне плавне центрування активної плашки при скролі або переході
  useEffect(() => {
    if (!activeNavId || !scrollContainerRef.current || searchQuery) return;
    const activeBtn = scrollContainerRef.current.querySelector<HTMLElement>(
      `[data-nav-id="${activeNavId}"]`,
    );
    if (!activeBtn) return;
    const container = scrollContainerRef.current;
    const pillLeft = activeBtn.offsetLeft;
    const pillWidth = activeBtn.offsetWidth;
    const containerWidth = container.offsetWidth;
    container.scrollTo({
      left: pillLeft - containerWidth / 2 + pillWidth / 2,
      behavior: "smooth",
    });
  }, [activeNavId, searchQuery]);

  return (
    <div
      ref={navRef}
      data-category-nav="true"
      className="sticky z-30 bg-[#FAF7F2] border-b border-[#EADFCF] py-2.5 sm:py-3 shadow-xs"
      style={{ top: "var(--header-height, 96px)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
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

          {/* Навігація категоріями та розділами із відстеженням активного елемента */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-w-0 relative flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar"
          >
            {/* Категорії страв каталогу */}
            {rootCategories.map((cat) => {
              const isSelected = !searchQuery && activeNavId === cat.id;
              return (
                <button
                  key={cat.id}
                  data-nav-id={cat.id}
                  type="button"
                  onClick={() => onSelectNav(cat.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#2C1E14] text-white shadow-md shadow-[#2C1E14]/15 scale-[1.02]"
                      : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
                  }`}
                >
                  {cat.icon && <span className="text-sm sm:text-base">{cat.icon}</span>}
                  <span>{cat.name}</span>
                </button>
              );
            })}

            {/* Розділювач між стравами та інформаційними розділами */}
            <div className="h-5 w-px bg-[#E2D5C3] mx-1 shrink-0" />

            {/* Секція Про пекарню */}
            <button
              data-nav-id="about"
              type="button"
              onClick={() => onSelectNav("about")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "about"
                  ? "bg-[#2C1E14] text-white shadow-md shadow-[#2C1E14]/15 scale-[1.02]"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>ℹ️</span>
              <span>Про нас</span>
            </button>

            {/* Секція Доставка */}
            <button
              data-nav-id="delivery"
              type="button"
              onClick={() => onSelectNav("delivery")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "delivery"
                  ? "bg-[#2C1E14] text-white shadow-md shadow-[#2C1E14]/15 scale-[1.02]"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>🛵</span>
              <span>Доставка</span>
            </button>

            {/* Секція Вакансії */}
            <button
              data-nav-id="careers"
              type="button"
              onClick={() => onSelectNav("careers")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "careers"
                  ? "bg-[#2C1E14] text-white shadow-md shadow-[#2C1E14]/15 scale-[1.02]"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>💼</span>
              <span>Вакансії</span>
            </button>

            {/* Секція Контакти */}
            <button
              data-nav-id="contacts"
              type="button"
              onClick={() => onSelectNav("contacts")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "contacts"
                  ? "bg-[#2C1E14] text-white shadow-md shadow-[#2C1E14]/15 scale-[1.02]"
                  : "bg-white hover:bg-[#F3EDE2] text-[#4A3B32] border border-[#E2D5C3]"
              }`}
            >
              <span>📍</span>
              <span>Контакти</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
