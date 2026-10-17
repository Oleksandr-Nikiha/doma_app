import { useEffect, useRef, useState } from "react";
import { useCart } from "../context/CartContext.tsx";
import { MobileNavMenu } from "./header/MobileNavMenu.tsx";
import { TopBar } from "./header/TopBar.tsx";
import { UserAvatar } from "./ui/UserAvatar.tsx";

interface HeaderProps {
  onOpenCart: () => void;
  phone?: string;
  address?: string;
  activeNavId?: string | number | null;
  onSelectNav?: (id: string | number) => void;
  lastOrderId?: number | null;
  onOpenTracking?: () => void;
  onOpenCabinet?: () => void;
  userName?: string | null;
  userAvatarUrl?: string | null;
  isAuthenticated?: boolean;
}

export function Header({
  onOpenCart,
  phone = "+380 (44) 222-00-11",
  address = "м. Київ, вул. Набережна, 12",
  activeNavId,
  onSelectNav,
  lastOrderId,
  onOpenTracking,
  onOpenCabinet,
  userName,
  userAvatarUrl,
  isAuthenticated = false,
}: HeaderProps) {
  const { totalQty, totalPrice } = useCart();
  const headerRef = useRef<HTMLElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-[#121417]/85 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/20"
    >
      {/* Верхня інформаційна стрічка */}
      <TopBar phone={phone} address={address} />

      {/* Головний хедер */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Логотип */}
        <a href="#top" className="flex items-center gap-2.5 sm:gap-3 group">
          <img
            src={logoSrc}
            alt="Urban Pizza & Sushi"
            className="h-10 sm:h-12 w-10 sm:w-12 rounded-full object-cover shadow-xs group-hover:scale-105 transition-transform border border-white/10"
          />
          <div className="border-l border-white/15 pl-2.5 hidden sm:block">
            <div className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[#E2583E] leading-tight">
              Urban Pizza & Sushi
            </div>
            <div className="text-[10px] text-[#94A3B8] leading-none mt-0.5">
              м. Київ • вул. Набережна, 12
            </div>
          </div>
        </a>

        {/* Навігація десктоп */}
        <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-semibold text-[#94A3B8]">
          <a
            href="#menu"
            onClick={(e) => handleNavClick(e, "menu")}
            className={`transition-colors py-1 ${
              typeof activeNavId === "number" || activeNavId === "menu"
                ? "text-[#E2583E] font-bold border-b-2 border-[#E2583E]"
                : "hover:text-white"
            }`}
          >
            Меню
          </a>
          <a
            href="#about"
            onClick={(e) => handleNavClick(e, "about")}
            className={`transition-colors py-1 ${
              activeNavId === "about"
                ? "text-[#E2583E] font-bold border-b-2 border-[#E2583E]"
                : "hover:text-white"
            }`}
          >
            Про заклад
          </a>
          <a
            href="#delivery"
            onClick={(e) => handleNavClick(e, "delivery")}
            className={`transition-colors py-1 ${
              activeNavId === "delivery"
                ? "text-[#E2583E] font-bold border-b-2 border-[#E2583E]"
                : "hover:text-white"
            }`}
          >
            Доставка
          </a>
          <a
            href="#careers"
            onClick={(e) => handleNavClick(e, "careers")}
            className={`transition-colors py-1 ${
              activeNavId === "careers"
                ? "text-[#E2583E] font-bold border-b-2 border-[#E2583E]"
                : "hover:text-white"
            }`}
          >
            Вакансії
          </a>
          <a
            href="#contacts"
            onClick={(e) => handleNavClick(e, "contacts")}
            className={`transition-colors py-1 ${
              activeNavId === "contacts"
                ? "text-[#E2583E] font-bold border-b-2 border-[#E2583E]"
                : "hover:text-white"
            }`}
          >
            Контакти
          </a>
        </nav>

        {/* Кнопки дій */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Кнопка особистого кабінету */}
          {onOpenCabinet && (
            <button
              onClick={onOpenCabinet}
              type="button"
              className="flex items-center gap-1.5 sm:gap-2 bg-[#1A1D24] hover:bg-[#222731] text-[#F1F5F9] border border-white/10 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl font-bold transition-all active:scale-95 cursor-pointer text-xs sm:text-sm shadow-xs shrink-0 whitespace-nowrap"
            >
              {isAuthenticated ? (
                <>
                  <UserAvatar avatarUrl={userAvatarUrl} name={userName} size="xs" />
                  <span className="max-w-[70px] sm:max-w-[100px] truncate hidden xs:inline sm:inline">
                    {userName ? userName.split(" ")[0] : "Кабінет"}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-base sm:text-lg">👤</span>
                  <span className="text-xs sm:text-sm">Увійти</span>
                </>
              )}
            </button>
          )}

          {/* Кнопка відстеження замовлення (якщо є активне) */}
          {lastOrderId && onOpenTracking && (
            <button
              onClick={onOpenTracking}
              type="button"
              className="flex items-center gap-1.5 sm:gap-2 bg-[#1A1D24] hover:bg-[#222731] text-[#F1F5F9] border border-white/10 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl font-bold transition-all active:scale-95 cursor-pointer text-xs sm:text-sm shadow-xs shrink-0 whitespace-nowrap"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="hidden xl:inline">Замовлення </span>
              <span className="hidden sm:inline xl:hidden">Зам. </span>
              <span>#{lastOrderId}</span>
            </button>
          )}

          {/* Кнопка Кошика */}
          <button
            onClick={onOpenCart}
            type="button"
            className="relative flex items-center gap-1.5 sm:gap-2 bg-[#1E232B] hover:bg-[#282F3B] text-white border border-white/10 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-semibold shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer text-xs sm:text-sm shrink-0 whitespace-nowrap"
          >
            <span className="text-base sm:text-lg">🛍️</span>
            <span className="hidden sm:inline">Кошик</span>
            {totalQty > 0 ? (
              <span className="bg-[#D34528] text-white font-bold text-xs px-2 py-0.5 rounded-full shrink-0">
                {totalQty} • {totalPrice} ₴
              </span>
            ) : (
              <span className="text-xs text-[#94A3B8] hidden sm:inline">порожній</span>
            )}
          </button>

          {/* Гамбургер-кнопка для мобільних */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            type="button"
            aria-label="Меню сайту"
            className="lg:hidden w-9 h-9 rounded-xl bg-[#1A1D24] border border-white/10 text-white flex items-center justify-center font-bold text-base hover:bg-[#222731] active:scale-95 transition-all cursor-pointer shadow-xs shrink-0"
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Мобільне навігаційне меню */}
      <MobileNavMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeNavId={activeNavId}
        onSelectNav={onSelectNav}
        lastOrderId={lastOrderId}
        onOpenTracking={onOpenTracking}
        onOpenCabinet={onOpenCabinet}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        isAuthenticated={isAuthenticated}
      />
    </header>
  );
}
