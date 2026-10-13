export function GroupHero() {
  const scrollToProjects = () => {
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToDomaClub = () => {
    document.getElementById("domaclub")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FAF7F2] via-[#F6EFE3] to-[#EFE5D3] pt-10 pb-16 sm:pb-24 border-b border-[#E8DFC8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Бейдж */}
          <div className="inline-flex items-center gap-2 bg-[#EADFCF] text-[#7A4B1A] px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wide">
            <span>🌐</span>
            <span>DomaGroup Inc. • Мережа смаку та гостинності</span>
          </div>

          {/* Заголовок */}
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#2C1E14] leading-[1.08] tracking-tight">
            Задоволення в усьому
          </h1>

          {/* Опис */}
          <p className="text-base sm:text-xl text-[#614F42] leading-relaxed max-w-2xl mx-auto font-normal">
            Від хрустких свіжоспечених круасанів на сніданок до гарячої піци та соковитих суші на дружню вечерю.
            Об'єднуємо улюблені смаки Вишгорода під знаком бездоганної якості.
          </p>

          {/* Кнопки дій */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
            <button
              type="button"
              onClick={scrollToProjects}
              className="bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-7 py-4 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-[#2C1E14]/15 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>🍽️</span>
              <span>Обрати заклад для замовлення</span>
              <span>↓</span>
            </button>
            <button
              type="button"
              onClick={scrollToDomaClub}
              className="bg-white hover:bg-[#F8F4EC] text-[#2C1E14] border border-[#D8C7B0] px-6 py-4 rounded-2xl font-bold text-sm sm:text-base shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>🎁</span>
              <span>Бонусна програма DomaClub</span>
            </button>
          </div>

          {/* Статистика та переваги */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-8 border-t border-[#E2D5C3]/80 max-w-3xl mx-auto text-left">
            <div className="bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-[#E8DFC8]">
              <div className="text-2xl font-black text-[#C8823E] font-display">2</div>
              <div className="text-xs font-bold text-[#2C1E14] mt-0.5">Локації у місті</div>
              <div className="text-[11px] text-[#7A695C]">Набережна & Шевченка</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-[#E8DFC8]">
              <div className="text-2xl font-black text-[#C8823E] font-display">0 ₴</div>
              <div className="text-xs font-bold text-[#2C1E14] mt-0.5">Доставка від 250 ₴</div>
              <div className="text-[11px] text-[#7A695C]">По всьому Вишгороду</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-[#E8DFC8]">
              <div className="text-2xl font-black text-[#C8823E] font-display">1 – 7%</div>
              <div className="text-xs font-bold text-[#2C1E14] mt-0.5">Кешбек DomaClub</div>
              <div className="text-[11px] text-[#7A695C]">1 бонус = 1 гривня</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-[#E8DFC8]">
              <div className="text-2xl font-black text-[#C8823E] font-display">10%</div>
              <div className="text-xs font-bold text-[#2C1E14] mt-0.5">До Дня Народження</div>
              <div className="text-[11px] text-[#7A695C]">Подарунок іменинникам</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
