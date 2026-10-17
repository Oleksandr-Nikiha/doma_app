export function GroupHero() {
  const scrollToProjects = () => {
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToUrbanClub = () => {
    document.getElementById("urbanclub")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-transparent pt-10 pb-16 sm:pb-24 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Бейдж */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wide">
            <span>🌐</span>
            <span>Urban Bites • Гастрономічна екосистема Києва</span>
          </div>

          {/* Заголовок */}
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] tracking-tight">
            Смак великого міста в один клік
          </h1>

          {/* Опис */}
          <p className="text-base sm:text-xl text-[#94A3B8] leading-relaxed max-w-2xl mx-auto font-normal">
            Від хрустких свіжоспечених круасанів на сніданок до гарячої неаполітанської піци та авторських ролів на дружню вечерю.
            Об'єднуємо улюблені смаки Києва під знаком бездоганної якості.
          </p>

          {/* Кнопки дій */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
            <button
              type="button"
              onClick={scrollToProjects}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0F1115] px-7 py-4 rounded-2xl font-extrabold text-sm sm:text-base shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>🍽️</span>
              <span>Обрати заклад для замовлення</span>
              <span>↓</span>
            </button>
            <button
              type="button"
              onClick={scrollToUrbanClub}
              className="bg-[#181B22] hover:bg-[#202530] text-[#F1F5F9] border border-white/15 px-6 py-4 rounded-2xl font-bold text-sm sm:text-base shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>🎁</span>
              <span>Бонусна програма URBAN CLUB</span>
            </button>
          </div>

          {/* Статистика та переваги */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-8 border-t border-white/10 max-w-3xl mx-auto text-left">
            <div className="bg-[#14171E]/90 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
              <div className="text-2xl font-black text-amber-400 font-display">2</div>
              <div className="text-xs font-bold text-white mt-0.5">Локації у місті</div>
              <div className="text-[11px] text-[#94A3B8]">Набережна & Вел. Васильківська</div>
            </div>
            <div className="bg-[#14171E]/90 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
              <div className="text-2xl font-black text-amber-400 font-display">0 ₴</div>
              <div className="text-xs font-bold text-white mt-0.5">Доставка від 250 ₴</div>
              <div className="text-[11px] text-[#94A3B8]">По всьому Києву</div>
            </div>
            <div className="bg-[#14171E]/90 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
              <div className="text-2xl font-black text-amber-400 font-display">1 – 7%</div>
              <div className="text-xs font-bold text-white mt-0.5">Кешбек URBAN CLUB</div>
              <div className="text-[11px] text-[#94A3B8]">1 бонус = 1 гривня</div>
            </div>
            <div className="bg-[#14171E]/90 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
              <div className="text-2xl font-black text-amber-400 font-display">10%</div>
              <div className="text-xs font-bold text-white mt-0.5">До Дня Народження</div>
              <div className="text-[11px] text-[#94A3B8]">Подарунок іменинникам</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
