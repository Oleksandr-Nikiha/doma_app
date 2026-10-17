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
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#E69A38] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide border border-white/10">
              <span>🥐</span>
              <span>Свіжі круасани, артизанський хліб, спешелті-кава</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.12]">
              Свіжі круасани, <br className="hidden sm:inline" />
              артизанський хліб <br className="hidden sm:inline" />
              та спешелті-кава
            </h1>

            <p className="text-base sm:text-lg text-[#94A3B8] max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Сучасна міська пекарня та спешелті-кав'ярня у серці Києва. Щодня з 08:00 випікаємо
              великі листкові круасани з солодкими та ситними начинками, крафтовий хліб та варимо добірну каву.
              Швидка доставка по Києву від 250&nbsp;грн безкоштовно або затишний самовивіз на вул. Велика Васильківська, 24.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={onScrollToMenu}
                type="button"
                className="bg-[#E69A38] hover:bg-[#D48927] text-[#0F1115] px-7 py-3.5 rounded-2xl font-bold text-base shadow-lg shadow-[#E69A38]/25 hover:shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                🥐 Переглянути меню
              </button>
              <a
                href="tel:+380442220022"
                className="bg-[#181B22] hover:bg-[#1E232B] text-[#F1F5F9] border border-white/10 px-6 py-3.5 rounded-2xl font-bold text-base shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>📞</span>
                <span>+380 (44) 222-00-22</span>
              </a>
            </div>

            {/* Переваги */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/10 max-w-lg mx-auto lg:mx-0 text-left">
              <div className="space-y-1">
                <div className="text-xl">🧈</div>
                <div className="text-xs sm:text-sm font-bold text-[#F1F5F9]">100% масло</div>
                <div className="text-[11px] text-[#94A3B8]">Листкове тісто власної випічки</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl">🛵</div>
                <div className="text-xs sm:text-sm font-bold text-[#F1F5F9]">від 250 ₴</div>
                <div className="text-[11px] text-[#94A3B8]">Безкоштовна доставка</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl">⏰</div>
                <div className="text-xs sm:text-sm font-bold text-[#F1F5F9]">08:00 – 21:00</div>
                <div className="text-[11px] text-[#94A3B8]">Щодня без вихідних</div>
              </div>
            </div>
          </div>

          {/* Фото-композиція */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="aspect-[4/3] sm:aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 relative z-10 bg-[#181B22]">
                <img
                  src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1000&q=80"
                  alt="Свіжі круасани Urban Bakery & Coffee"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                />
              </div>

              {/* Декоративні плашки */}
              <div className="absolute -bottom-5 -left-5 bg-[#181B22]/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/10 z-20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#252A34] flex items-center justify-center text-xl">
                  🥖
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F1F5F9]">Крафтовий хліб</div>
                  <div className="text-[11px] text-[#94A3B8]">На натуральній заквасці</div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-[#181B22] text-[#F1F5F9] rounded-2xl p-3.5 shadow-xl border border-white/10 z-20 hidden sm:flex items-center gap-2 text-xs font-semibold">
                <span>⭐</span>
                <span>Улюблена пекарня столиці</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

