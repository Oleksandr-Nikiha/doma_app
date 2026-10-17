interface HeroProps {
  onScrollToMenu: () => void;
}

export function Hero({ onScrollToMenu }: HeroProps) {
  return (
    <section id="hero" className="relative overflow-hidden bg-gradient-to-b from-transparent via-[#14171E]/60 to-[#121417]/80 pt-8 pb-16 md:py-20 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Текстовий блок */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-[#D34528]/15 text-[#E2583E] border border-[#D34528]/30 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide">
              <span>🍕🍣</span>
              <span>Неаполітанська піца, авторські роли, сучасний стрітфуд • Київ</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.12]">
              Гаряча піца, <br className="hidden sm:inline" />
              авторські роли <br className="hidden sm:inline" />
              та сучасний стрітфуд
            </h1>

            <p className="text-base sm:text-lg text-[#94A3B8] max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Справжня неаполітанська піца, великі авторські суші-сети з охолодженим лососем,
              крафтові бургери та боули. Швидка доставка по Києву від 250&nbsp;₴
              безкоштовно або самовивіз на вул. Набережна, 12.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={onScrollToMenu}
                type="button"
                className="bg-[#D34528] hover:bg-[#B34B24] text-white px-7 py-3.5 rounded-2xl font-bold text-base shadow-lg shadow-[#D34528]/30 hover:shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                🍕 Переглянути меню
              </button>
              <a
                href="tel:+380442220011"
                className="bg-[#1A1D24] hover:bg-[#242933] text-[#F1F5F9] border border-white/15 px-6 py-3.5 rounded-2xl font-bold text-base shadow-sm transition-all flex items-center gap-2"
              >
                <span>📞</span>
                <span>+380 (44) 222-00-11</span>
              </a>
            </div>

            {/* Переваги */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/10 max-w-lg mx-auto lg:mx-0 text-left">
              <div className="space-y-1">
                <div className="text-xl">🍕</div>
                <div className="text-xs sm:text-sm font-bold text-white">Пишне тісто</div>
                <div className="text-[11px] text-[#94A3B8]">48 год холодної ферментації</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl">🍣</div>
                <div className="text-xs sm:text-sm font-bold text-white">Свіжий лосось</div>
                <div className="text-[11px] text-[#94A3B8]">Тільки охолоджена риба</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl">🛵</div>
                <div className="text-xs sm:text-sm font-bold text-white">від 250 ₴</div>
                <div className="text-[11px] text-[#94A3B8]">Безкоштовна доставка</div>
              </div>
            </div>
          </div>

          {/* Фото-композиція */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="aspect-[4/3] sm:aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 relative z-10 bg-[#1A1D24]">
                <img
                  src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80"
                  alt="Гаряча піца Urban Pizza"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 opacity-90"
                />
              </div>

              {/* Декоративні плашки */}
              <div className="absolute -bottom-5 -left-5 bg-[#181B22]/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/10 z-20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E3A2F] text-emerald-300 flex items-center justify-center text-xl shadow-xs border border-emerald-500/30">
                  🍣
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-400">Авторські роли та сети</div>
                  <div className="text-[11px] text-[#94A3B8]">Щедра порція лосося та сиру</div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-[#1E232B] text-white border border-white/10 rounded-2xl p-3.5 shadow-2xl z-20 hidden sm:flex items-center gap-2 text-xs font-semibold">
                <span>⭐</span>
                <span>Улюблена доставка міста</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
