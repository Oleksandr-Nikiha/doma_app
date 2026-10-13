interface HeroProps {
  onScrollToMenu: () => void;
}

export function Hero({ onScrollToMenu }: HeroProps) {
  return (
    <section id="hero" className="relative overflow-hidden bg-gradient-to-b from-[#FAF7F2] to-[#F3EDE2] pt-8 pb-16 md:py-20 border-b border-[#EADFCF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Текстовий блок */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-[#EADFCF] text-[#7A4B1A] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide">
              <span>🍕🍣</span>
              <span>Перша швидка доставка задоволення у Вишгороді</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#2C1E14] leading-[1.12]">
              Гаряча піца, <br className="hidden sm:inline" />
              свіжі роли <br className="hidden sm:inline" />
              та соковиті бургери
            </h1>

            <p className="text-base sm:text-lg text-[#614F42] max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Справжня піца з італійським характером, великі суші-сети з охолодженим лососем,
              крафтові бургери та сети закусок. Швидка доставка по Вишгороду від 250&nbsp;₴
              безкоштовно або самовивіз на вул. Набережна, 8Д.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={onScrollToMenu}
                type="button"
                className="bg-[#C85A32] hover:bg-[#B34B24] text-white px-7 py-3.5 rounded-2xl font-bold text-base shadow-lg shadow-[#C85A32]/25 hover:shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                🍕 Переглянути меню
              </button>
              <a
                href="tel:+380671127733"
                className="bg-white hover:bg-[#F5EFE6] text-[#2C1E14] border border-[#D8C7B0] px-6 py-3.5 rounded-2xl font-bold text-base shadow-sm transition-all flex items-center gap-2"
              >
                <span>📞</span>
                <span>+380 67 112 77 33</span>
              </a>
            </div>

            {/* Переваги */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[#E2D5C3] max-w-lg mx-auto lg:mx-0 text-left">
              <div className="space-y-1">
                <div className="text-xl">🍕</div>
                <div className="text-xs sm:text-sm font-bold text-[#2C1E14]">Пишне тісто</div>
                <div className="text-[11px] text-[#7A695C]">48 год холодної ферментації</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl">🍣</div>
                <div className="text-xs sm:text-sm font-bold text-[#2C1E14]">Свіжий лосось</div>
                <div className="text-[11px] text-[#7A695C]">Тільки охолоджена риба</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl">🛵</div>
                <div className="text-xs sm:text-sm font-bold text-[#2C1E14]">від 250 ₴</div>
                <div className="text-[11px] text-[#7A695C]">Безкоштовна доставка</div>
              </div>
            </div>
          </div>

          {/* Фото-композиція */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="aspect-[4/3] sm:aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white relative z-10 bg-[#EADFCF]">
                <img
                  src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80"
                  alt="Гаряча піца Doma Pizza"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                />
              </div>

              {/* Декоративні плашки */}
              <div className="absolute -bottom-5 -left-5 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-[#E8DFC8] z-20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF5E6] flex items-center justify-center text-xl">
                  🍣
                </div>
                <div>
                  <div className="text-xs font-bold text-[#2C1E14]">Суші та сети</div>
                  <div className="text-[11px] text-[#7A695C]">Щедра порція риби та сиру</div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-[#2C1E14] text-white rounded-2xl p-3.5 shadow-xl z-20 hidden sm:flex items-center gap-2 text-xs font-semibold">
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
