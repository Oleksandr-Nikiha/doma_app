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
              <span>🥐</span>
              <span>Перша пекарня задоволення у Вишгороді</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#2C1E14] leading-[1.12]">
              Великі хрусткі круасани, <br className="hidden sm:inline" />
              авторська кава <br className="hidden sm:inline" />
              та бенто-піци
            </h1>

            <p className="text-base sm:text-lg text-[#614F42] max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Справжня майстерня смаку у Вишгороді. Щодня з 08:00 випікаємо великі листкові
              круасани з солодкими та ситними начинками, готуємо свіжу каву та гарячі бенто-піци.
              Швидка доставка від 250&nbsp;грн безкоштовно або самовивіз на просп. Шевченка, 2Д.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={onScrollToMenu}
                type="button"
                className="bg-[#C8823E] hover:bg-[#B36F2D] text-white px-7 py-3.5 rounded-2xl font-bold text-base shadow-lg shadow-[#C8823E]/25 hover:shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                🥐 Переглянути меню
              </button>
              <a
                href="tel:+380931127733"
                className="bg-white hover:bg-[#F5EFE6] text-[#2C1E14] border border-[#D8C7B0] px-6 py-3.5 rounded-2xl font-bold text-base shadow-sm transition-all flex items-center gap-2"
              >
                <span>📞</span>
                <span>+380 93 112 77 33</span>
              </a>
            </div>

            {/* Переваги */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[#E2D5C3] max-w-lg mx-auto lg:mx-0 text-left">
              <div className="space-y-1">
                <div className="text-xl">🧈</div>
                <div className="text-xs sm:text-sm font-bold text-[#2C1E14]">100% масло</div>
                <div className="text-[11px] text-[#7A695C]">Листкове тісто власної випічки</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl">🛵</div>
                <div className="text-xs sm:text-sm font-bold text-[#2C1E14]">від 250 ₴</div>
                <div className="text-[11px] text-[#7A695C]">Безкоштовна доставка</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl">⏰</div>
                <div className="text-xs sm:text-sm font-bold text-[#2C1E14]">08:00 – 20:00</div>
                <div className="text-[11px] text-[#7A695C]">Щодня без вихідних</div>
              </div>
            </div>
          </div>

          {/* Фото-композиція */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="aspect-[4/3] sm:aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white relative z-10 bg-[#EADFCF]">
                <img
                  src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1000&q=80"
                  alt="Свіжі круасани Doma"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                />
              </div>

              {/* Декоративні плашки */}
              <div className="absolute -bottom-5 -left-5 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-[#E8DFC8] z-20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF5E6] flex items-center justify-center text-xl">
                  🍕
                </div>
                <div>
                  <div className="text-xs font-bold text-[#2C1E14]">Бенто-піци</div>
                  <div className="text-[11px] text-[#7A695C]">Ідеальна порція для одного</div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-[#2C1E14] text-white rounded-2xl p-3.5 shadow-xl z-20 hidden sm:flex items-center gap-2 text-xs font-semibold">
                <span>⭐</span>
                <span>Улюблена кав'ярня міста</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

