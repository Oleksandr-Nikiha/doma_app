import { useEffect, useRef, useState } from "react";
import { useCart } from "../context/CartContext.tsx";
import { getWorkingHoursInfo } from "../utils/workingHours.ts";

interface HeaderProps {
  onOpenCart: () => void;
  phone?: string;
  address?: string;
  activeNavId?: string | number | null;
  onSelectNav?: (id: string | number) => void;
  lastOrderId?: number | null;
  onOpenTracking?: () => void;
}

export function Header({
  onOpenCart,
  phone = "+380 93 112 77 33",
  address = "Вишгород, просп. Шевченка, 2Д",
  activeNavId,
  onSelectNav,
  lastOrderId,
  onOpenTracking,
}: HeaderProps) {
  const { totalQty, totalPrice } = useCart();
  const headerRef = useRef<HTMLElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hoursInfo = getWorkingHoursInfo();

  // Динамічний розрахунок реальної висоти хедера з прив'язкою до CSS-змінної
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateHeight = () => {
      const height = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--header-height",
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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);

    if (onSelectNav) {
      onSelectNav(targetId);
      return;
    }

    const target = document.getElementById(targetId);
    if (!target) return;

    const headerH = headerRef.current ? headerRef.current.getBoundingClientRect().height : 96;
    const navEl = document.querySelector("[data-category-nav]");
    const navH = navEl ? navEl.getBoundingClientRect().height : 56;
    const offset = headerH + navH + 16;

    const targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-[#FAF7F2] border-b border-[#E8DFC8] shadow-xs"
    >
      {/* Верхня інформаційна стрічка */}
      <div className="bg-[#2C1E14] text-[#E8DFC8] text-xs py-1.5 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          {/* Ліва частина: статус графіку */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1.5 shrink-0">
              <span
                className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                  hoursInfo.badgeColor === "emerald"
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400"
                }`}
              ></span>
              {/* Короткий текст для мобільних — ніколи не залазить під номер */}
              <span className="text-[#F3EDE2] font-semibold sm:hidden whitespace-nowrap text-[11px]">
                {hoursInfo.shortStatusText}
              </span>
              {/* Повний текст для екранів від sm */}
              <span className="text-[#F3EDE2] font-medium hidden sm:inline whitespace-nowrap">
                {hoursInfo.statusText}
              </span>
            </span>

            <span className="text-[#8D7665] hidden md:inline">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-[#D4C3AC] shrink-0">
              🛵 Доставка: 10:00 – 20:00 (від 250 ₴ безкоштовно)
            </span>
            <span className="hidden lg:inline-block text-[#8D7665]">|</span>
            <span className="hidden lg:inline-flex items-center gap-1 text-[#D4C3AC] truncate">
              📍 {address}
            </span>
          </div>

          {/* Права частина: контакти */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <a
              href="https://www.instagram.com/doma.croissants/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-[#E8DFC8] hover:text-[#E29E57] transition-colors"
            >
              <span>📷</span>
              <span className="hidden md:inline">@doma.croissants</span>
            </a>
            <span className="hidden sm:inline-block text-[#8D7665]">|</span>
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="font-bold sm:font-medium text-[11px] sm:text-xs text-[#E8DFC8] hover:text-white transition-colors whitespace-nowrap"
            >
              📞 {phone}
            </a>
            <a
              href="https://t.me/ncoffee_app_tst_bot"
              target="_blank"
              rel="noreferrer"
              className="hidden xl:inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
            >
              📱 Telegram-бот
            </a>
          </div>
        </div>
      </div>

      {/* Головний хедер */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Логотип */}
        <a href="#top" className="flex items-center gap-2.5 sm:gap-3 group">
          <img
            src="/logo.png"
            alt="Doma Croissants"
            className="h-8 sm:h-11 w-auto object-contain group-hover:scale-102 transition-transform"
          />
          <div className="border-l border-[#E2D5C3] pl-2 hidden sm:block">
            <div className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[#9C5B23] leading-tight">
              Перша пекарня задоволення
            </div>
            <div className="text-[10px] text-[#7A695C] leading-none mt-0.5">
              м. Вишгород
            </div>
          </div>
        </a>

        {/* Навігація десктоп */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#4A3B32]">
          <a
            href="#menu"
            onClick={(e) => handleNavClick(e, "menu")}
            className={`transition-colors py-1 ${
              typeof activeNavId === "number" || activeNavId === "menu"
                ? "text-[#C8823E] font-bold border-b-2 border-[#C8823E]"
                : "hover:text-[#C8823E]"
            }`}
          >
            Меню
          </a>
          <a
            href="#about"
            onClick={(e) => handleNavClick(e, "about")}
            className={`transition-colors py-1 ${
              activeNavId === "about"
                ? "text-[#C8823E] font-bold border-b-2 border-[#C8823E]"
                : "hover:text-[#C8823E]"
            }`}
          >
            Про пекарню
          </a>
          <a
            href="#delivery"
            onClick={(e) => handleNavClick(e, "delivery")}
            className={`transition-colors py-1 ${
              activeNavId === "delivery"
                ? "text-[#C8823E] font-bold border-b-2 border-[#C8823E]"
                : "hover:text-[#C8823E]"
            }`}
          >
            Доставка
          </a>
          <a
            href="#careers"
            onClick={(e) => handleNavClick(e, "careers")}
            className={`transition-colors py-1 ${
              activeNavId === "careers"
                ? "text-[#C8823E] font-bold border-b-2 border-[#C8823E]"
                : "hover:text-[#C8823E]"
            }`}
          >
            Вакансії
          </a>
          <a
            href="#contacts"
            onClick={(e) => handleNavClick(e, "contacts")}
            className={`transition-colors py-1 ${
              activeNavId === "contacts"
                ? "text-[#C8823E] font-bold border-b-2 border-[#C8823E]"
                : "hover:text-[#C8823E]"
            }`}
          >
            Контакти
          </a>
        </nav>

        {/* Кнопки дій: Трекінг, Кошик та Мобільне меню */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Кнопка відстеження замовлення (якщо є активне) */}
          {lastOrderId && onOpenTracking && (
            <button
              onClick={onOpenTracking}
              type="button"
              className="flex items-center gap-1.5 sm:gap-2 bg-[#F3EDE2] hover:bg-[#EADFCF] text-[#2C1E14] border border-[#E2D5C3] px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold transition-all active:scale-95 cursor-pointer text-xs sm:text-sm shadow-2xs"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="hidden sm:inline">Замовлення</span>
              <span>#{lastOrderId}</span>
            </button>
          )}

          {/* Кнопка Кошика */}
          <button
            onClick={onOpenCart}
            type="button"
            className="relative flex items-center gap-1.5 sm:gap-2 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer text-xs sm:text-sm"
          >
            <span className="text-base sm:text-lg">🛍️</span>
            <span className="hidden sm:inline">Кошик</span>
            {totalQty > 0 ? (
              <span className="bg-[#E29E57] text-[#2C1E14] font-bold text-xs px-2 py-0.5 rounded-full">
                {totalQty} • {totalPrice} ₴
              </span>
            ) : (
              <span className="text-xs text-[#A8988B] hidden sm:inline">порожній</span>
            )}
          </button>

          {/* Гамбургер-кнопка для мобільних */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            type="button"
            aria-label="Меню сайту"
            className="md:hidden w-9 h-9 rounded-xl bg-white border border-[#E2D5C3] text-[#2C1E14] flex items-center justify-center font-bold text-base hover:bg-[#F3EDE2] active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Випадаюче мобільне меню для швидкого переходу */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#E8DFC8] bg-[#FAF7F2] p-4 shadow-lg animate-in slide-in-from-top-4 duration-200">
          {/* Відстеження замовлення у мобільному меню */}
          {lastOrderId && onOpenTracking && (
            <div className="mb-3">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenTracking();
                }}
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#FFF8EE] border border-[#E8DFC8] text-[#9C5B23] font-bold text-xs active:scale-98 transition-transform shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>📦 Відстежити замовлення #{lastOrderId}</span>
                </span>
                <span>→</span>
              </button>
            </div>
          )}
          <nav className="flex flex-col space-y-2 text-sm font-bold text-[#2C1E14]">
            <a
              href="#menu"
              onClick={(e) => handleNavClick(e, "menu")}
              className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                typeof activeNavId === "number" || activeNavId === "menu"
                  ? "bg-[#F3EDE2] text-[#9C5B23] font-extrabold"
                  : "hover:bg-[#F3EDE2]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span>🥐</span>
                <span>Меню та страви</span>
              </span>
              <span className="text-xs text-[#9C5B23]">62 позиції →</span>
            </a>
            <a
              href="#about"
              onClick={(e) => handleNavClick(e, "about")}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl transition-colors ${
                activeNavId === "about"
                  ? "bg-[#F3EDE2] text-[#9C5B23] font-extrabold"
                  : "hover:bg-[#F3EDE2]"
              }`}
            >
              <span>ℹ️</span>
              <span>Про пекарню Doma</span>
            </a>
            <a
              href="#delivery"
              onClick={(e) => handleNavClick(e, "delivery")}
              className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                activeNavId === "delivery"
                  ? "bg-[#F3EDE2] text-[#9C5B23] font-extrabold"
                  : "hover:bg-[#F3EDE2]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span>🛵</span>
                <span>Доставка та оплата</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                від 250 ₴ 0 ₴
              </span>
            </a>
            <a
              href="#careers"
              onClick={(e) => handleNavClick(e, "careers")}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl transition-colors ${
                activeNavId === "careers"
                  ? "bg-[#F3EDE2] text-[#9C5B23] font-extrabold"
                  : "hover:bg-[#F3EDE2]"
              }`}
            >
              <span>💼</span>
              <span>Вакансії в команді</span>
            </a>
            <a
              href="#contacts"
              onClick={(e) => handleNavClick(e, "contacts")}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl transition-colors ${
                activeNavId === "contacts"
                  ? "bg-[#F3EDE2] text-[#9C5B23] font-extrabold"
                  : "hover:bg-[#F3EDE2]"
              }`}
            >
              <span>📍</span>
              <span>Контакти та адреса</span>
            </a>
          </nav>

          <div className="mt-4 pt-3 border-t border-[#E8DFC8] flex flex-col gap-2">
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="flex items-center justify-center gap-2 bg-[#2C1E14] text-white py-2.5 rounded-xl text-xs font-bold shadow-xs active:scale-98"
            >
              <span>📞</span>
              <span>Зателефонувати: {phone}</span>
            </a>
            <a
              href="https://www.instagram.com/doma.croissants/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-white border border-[#E2D5C3] text-[#2C1E14] py-2 rounded-xl text-xs font-semibold"
            >
              <span>📷</span>
              <span>Instagram @doma.croissants</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
