import { useState } from "react";
import type { UserProfile } from "../types/user.ts";

interface GroupHeaderProps {
  onOpenCabinet?: () => void;
  userProfile?: UserProfile | null;
}

export function GroupHeader({ onOpenCabinet, userProfile }: GroupHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  const navItems = [
    { label: "Проєкти", href: "#projects" },
    { label: "DomaClub", href: "#domaclub" },
    { label: "Акції", href: "#promotions" },
    { label: "Партнерство", href: "#partnership" },
    { label: "Вакансії", href: "#careers" },
    { label: "Контакти", href: "#contacts" },
  ];

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFC8] shadow-xs">
      {/* Інформаційна верхня плашка */}
      <div className="bg-[#2C1E14] text-[#E8DFC8] text-xs py-2 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-amber-300">🌟 DomaGroup Inc.</span>
            <span className="hidden sm:inline text-[#8D7665]">|</span>
            <span className="hidden sm:inline text-[#D4C3AC]">Мережа закладів гостинності у Вишгороді</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={onOpenCabinet}
              className="hover:text-amber-300 transition-colors flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <span>🎁</span>
              <span>
                {userProfile?.bonuses !== undefined && userProfile.bonuses > 0
                  ? `DomaClub (${userProfile.bonuses} б.)`
                  : "DomaClub Лояльність"}
              </span>
            </button>
            <a
              href="mailto:domagroup.inc@gmail.com"
              className="hidden md:inline hover:text-white transition-colors"
            >
              domagroup.inc@gmail.com
            </a>
          </div>
        </div>
      </div>

      {/* Основний хедер */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Логотип */}
        <a href="#top" className="flex items-center gap-3 group">
          <img
            src={logoSrc}
            alt="DomaGroup"
            className="h-9 sm:h-11 w-auto object-contain group-hover:scale-102 transition-transform"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div>
            <span className="font-display text-xl sm:text-2xl font-bold text-[#2C1E14] tracking-tight block leading-tight">
              DomaGroup
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#8D7B6D] tracking-wider uppercase block">
              Мережа смаку • Вишгород
            </span>
          </div>
        </a>

        {/* Десктоп-навігація */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-[#4A3B32]">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(item.href);
              }}
              className="hover:text-[#C8823E] transition-colors py-1"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Швидкі кнопки переходу до замовлення та кабінету */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Кнопка кабінету DomaClub */}
          <button
            type="button"
            onClick={onOpenCabinet}
            className="inline-flex items-center gap-1.5 bg-[#FFF2DE] hover:bg-[#FCE7C8] text-[#9C5B23] border border-[#ECD9BF] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Особистий кабінет DomaClub"
          >
            <span>🎁</span>
            <span className="hidden md:inline">
              {userProfile?.name ? userProfile.name.split(" ")[0] : "DomaClub"}
            </span>
            {userProfile?.bonuses !== undefined && userProfile.bonuses > 0 && (
              <span className="bg-[#E29E57] text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {userProfile.bonuses}
              </span>
            )}
          </button>

          <a
            href="/pizza/"
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-[#2C1E14]/15"
          >
            <span>🍕</span>
            <span>Піца & Суші</span>
          </a>
          <a
            href="/croissant/"
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-[#2C1E14]/15"
          >
            <span>🥐</span>
            <span>Круасани</span>
          </a>

          {/* Мобільна кнопка гамбургера */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#FAF7F2] border border-[#D8C7B0] text-[#2C1E14] hover:bg-[#F3EDE2] cursor-pointer"
            aria-label="Меню"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Мобільне меню */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E8DFC8] bg-[#FAF7F2] px-4 py-5 space-y-4 animate-in slide-in-from-top-2">
          {/* Кнопка кабінету в мобільному меню */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenCabinet?.();
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#FFF2DE] text-[#9C5B23] border border-[#ECD9BF] py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <span>🎁</span>
            <span>
              {userProfile?.name
                ? `Кабінет DomaClub (${userProfile.name.split(" ")[0]})`
                : "Особистий кабінет DomaClub"}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#E8DFC8]">
            <a
              href="/pizza/"
              className="flex items-center justify-center gap-1.5 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <span>🍕</span>
              <span>Doma Pizza</span>
            </a>
            <a
              href="/croissant/"
              className="flex items-center justify-center gap-1.5 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <span>🥐</span>
              <span>Doma Croissants</span>
            </a>
          </div>
          <nav className="flex flex-col space-y-2.5 text-sm font-semibold text-[#4A3B32]">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                }}
                className="py-1.5 hover:text-[#C8823E]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
