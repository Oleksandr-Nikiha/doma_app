export function AboutSection() {
  return (
    <section
      id="about"
      className="bg-white py-16 sm:py-20 border-t border-[#EADFCF]"
      style={{
        scrollMarginTop:
          "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#F3EDE2] text-[#C85A32] px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
              <span>🍕🍣</span>
              <span>Перша швидка доставка задоволення</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C1E14] leading-tight">
              Doma Pizza & Sushi — смак, якому довіряє Вишгород
            </h2>
            <div className="space-y-4 text-[#614F42] leading-relaxed text-sm sm:text-base">
              <p>
                <strong className="text-[#2C1E14]">Doma Pizza & Sushi</strong> – це флагманський заклад
                мережі DomaGroup, який щодня дарує радість смаку жителям та гостям Вишгорода.
              </p>
              <p>
                Наша піца готується на авторському тісті з 48-годинною холодною ферментацією,
                що робить бортики неймовірно легкими та хрусткими. А для суші та ролів ми
                використовуємо виключно охолоджений норвезький лосось, добірний рис та преміальний крем-сир.
              </p>
              <p>
                Ми цінуємо ваш час, тому гарантуємо швидку доставку гарячих страв у спеціальних
                термосумках безпосередньо до ваших дверей або швидку видачу замовлення на самовивіз.
              </p>
            </div>

            {/* Ключові факти */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#EADFCF]">
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C85A32]">
                  48 годин
                </div>
                <div className="text-xs text-[#7A695C] mt-0.5">Ферментація тіста</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C85A32]">
                  від 250 ₴
                </div>
                <div className="text-xs text-[#7A695C] mt-0.5">Безкоштовна доставка</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C85A32]">
                  100%
                </div>
                <div className="text-xs text-[#7A695C] mt-0.5">Свіжий лосось</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C85A32]">
                  10:30–21:30
                </div>
                <div className="text-xs text-[#7A695C] mt-0.5">Щодня без вихідних</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl bg-[#FAF7F2]">
              <img
                src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80"
                alt="Піца Doma Pizza"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl bg-[#FAF7F2] mt-8">
              <img
                src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80"
                alt="Суші та роли Doma Sushi"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
