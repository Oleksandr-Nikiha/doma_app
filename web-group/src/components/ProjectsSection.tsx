export function ProjectsSection() {
  return (
    <section id="projects" className="py-16 sm:py-24 bg-white border-b border-[#EADFCF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Заголовок секції */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C8823E]">
            Наші заклади
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C1E14]">
            Проєкти мережі DomaGroup
          </h2>
          <p className="text-sm sm:text-base text-[#614F42]">
            Оберіть заклад за смаком та замовляйте улюблені страви онлайн з доставкою або самовивозом
          </p>
        </div>

        {/* Картки двох закладів */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          {/* Картка 1: Doma Pizza & Sushi */}
          <div className="bg-[#FAF7F2] rounded-3xl sm:rounded-[32px] p-6 sm:p-8 border border-[#E8DFC8] flex flex-col justify-between hover:shadow-xl transition-all duration-300 group">
            <div className="space-y-6">
              {/* Зображення */}
              <div className="aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EADFCF] relative shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80"
                  alt="Doma Pizza & Sushi"
                  className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-700"
                />
                <div className="absolute top-3 left-3 bg-[#2C1E14]/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span>🍕🍣</span>
                  <span>Піца, Суші, Бургери</span>
                </div>
                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs text-[#2C1E14] text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  🛵 10:30 – 21:30
                </div>
              </div>

              {/* Інфо */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#2C1E14]">
                    Doma Pizza & Sushi
                  </h3>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
                    Працює зараз
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#8D7665] flex items-center gap-1.5">
                  <span>📍</span>
                  <span>м. Вишгород, вул. Набережна, 8Д</span>
                </div>

                <p className="text-sm text-[#614F42] leading-relaxed">
                  Перша швидка доставка задоволення у Вишгороді. Гаряча неаполітанська піца на
                  48-годинному тісті, щедрі роли зі свіжим охолодженим лососем, соковиті бургери,
                  боули та комбо-бокси.
                </p>

                {/* Теги */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold bg-white border border-[#E2D5C3] text-[#614F42] px-2.5 py-1 rounded-lg">
                    🍕 16 видів піци
                  </span>
                  <span className="text-[11px] font-semibold bg-white border border-[#E2D5C3] text-[#614F42] px-2.5 py-1 rounded-lg">
                    🍣 Сети від 450 ₴
                  </span>
                  <span className="text-[11px] font-semibold bg-white border border-[#E2D5C3] text-[#614F42] px-2.5 py-1 rounded-lg">
                    🍔 Крафтові бургери
                  </span>
                  <span className="text-[11px] font-semibold bg-white border border-[#E2D5C3] text-[#614F42] px-2.5 py-1 rounded-lg">
                    🛵 Безкоштовно від 250 ₴
                  </span>
                </div>
              </div>
            </div>

            {/* Дії */}
            <div className="pt-6 mt-6 border-t border-[#E8DFC8] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <a
                href="/pizza/"
                className="flex-1 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-3.5 px-5 rounded-2xl font-bold text-center text-sm shadow-md shadow-[#2C1E14]/15 transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <span>Перейти до замовлення</span>
                <span>→</span>
              </a>
              <a
                href="tel:+380671127733"
                className="bg-white hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#D8C7B0] py-3.5 px-4 rounded-2xl font-bold text-sm text-center transition-colors flex items-center justify-center gap-2"
              >
                <span>📞</span>
                <span>+380 67 112 77 33</span>
              </a>
            </div>
          </div>

          {/* Картка 2: Doma Croissants */}
          <div className="bg-[#FAF7F2] rounded-3xl sm:rounded-[32px] p-6 sm:p-8 border border-[#E8DFC8] flex flex-col justify-between hover:shadow-xl transition-all duration-300 group">
            <div className="space-y-6">
              {/* Зображення */}
              <div className="aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EADFCF] relative shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80"
                  alt="Doma Croissants"
                  className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-700"
                />
                <div className="absolute top-3 left-3 bg-[#2C1E14]/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span>🥐☕</span>
                  <span>Пекарня & Кав'ярня</span>
                </div>
                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs text-[#2C1E14] text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  ⏰ 08:00 – 20:00
                </div>
              </div>

              {/* Інфо */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#2C1E14]">
                    Doma Croissants
                  </h3>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
                    Працює зараз
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#8D7665] flex items-center gap-1.5">
                  <span>📍</span>
                  <span>м. Вишгород, просп. Шевченка, 2Д</span>
                </div>

                <p className="text-sm text-[#614F42] leading-relaxed">
                  Перша пекарня задоволення у Вишгороді. Щодня свіжа випічка з 08:00:
                  великі французькі круасани з солодкими та ситними начинками, авторська кава,
                  гарячі бенто-піци та ролліни.
                </p>

                {/* Теги */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold bg-white border border-[#E2D5C3] text-[#614F42] px-2.5 py-1 rounded-lg">
                    🥐 100% листкове масло
                  </span>
                  <span className="text-[11px] font-semibold bg-white border border-[#E2D5C3] text-[#614F42] px-2.5 py-1 rounded-lg">
                    ☕ Авторська кава
                  </span>
                  <span className="text-[11px] font-semibold bg-white border border-[#E2D5C3] text-[#614F42] px-2.5 py-1 rounded-lg">
                    🍕 Бенто-піци
                  </span>
                  <span className="text-[11px] font-semibold bg-white border border-[#E2D5C3] text-[#614F42] px-2.5 py-1 rounded-lg">
                    🛵 Доставка від 250 ₴
                  </span>
                </div>
              </div>
            </div>

            {/* Дії */}
            <div className="pt-6 mt-6 border-t border-[#E8DFC8] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <a
                href="/croissant/"
                className="flex-1 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-3.5 px-5 rounded-2xl font-bold text-center text-sm shadow-md shadow-[#2C1E14]/15 transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <span>Перейти до замовлення</span>
                <span>→</span>
              </a>
              <a
                href="tel:+380931127733"
                className="bg-white hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#D8C7B0] py-3.5 px-4 rounded-2xl font-bold text-sm text-center transition-colors flex items-center justify-center gap-2"
              >
                <span>📞</span>
                <span>+380 93 112 77 33</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
