export function Footer() {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  return (
    <footer
      id="contacts"
      className="bg-[#2C1E14] text-[#E8DFC8] pt-16 pb-12 border-t border-[#3D2C1F]"
      style={{
        scrollMarginTop:
          "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#4A3B32]">
          {/* Колонка 1: Про нас */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={logoSrc}
                alt="Doma Pizza & Sushi"
                className="h-10 w-auto object-contain brightness-0 invert"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="text-xs uppercase text-[#E29E57] tracking-wider font-bold">
              Перша швидка доставка задоволення
            </div>
            <p className="text-sm text-[#B8A796] leading-relaxed max-w-sm">
              Справжня італійська піца на фірмовому тісті, свіжі роли з щедрим шаром лосося,
              соковиті бургери та закуски. Доставляємо гарячим по всьому Вишгороду.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://www.instagram.com/domapizza.sushi/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-[#3D2C1F] hover:bg-[#4E3928] text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <span>📷</span>
                <span>Instagram: @domapizza.sushi</span>
              </a>
            </div>
          </div>

          {/* Колонка 2: Контакти та локація */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="font-display text-lg font-bold text-white">
              Локація та контакти
            </h3>
            <ul className="space-y-2.5 text-sm text-[#D4C3AC]">
              <li className="flex items-start gap-2.5">
                <span>📍</span>
                <div>
                  <a
                    href="https://maps.app.goo.gl/BRLZFuPRPjxBUq3M9"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white underline underline-offset-2 transition-colors"
                  >
                    м. Вишгород, вул. Набережна, 8Д
                  </a>
                  <div className="text-xs text-[#9E8B79]">На мапі міста</div>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <span>🍕</span>
                <span>Заклад: Щодня 10:30 – 21:30</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span>🛵</span>
                <span>Доставка: Щодня 10:30 – 21:30 (від 250 ₴ безкоштовно)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span>📞</span>
                <div className="flex flex-col sm:flex-row sm:gap-3">
                  <a
                    href="tel:+380671127733"
                    className="hover:text-white font-semibold transition-colors"
                  >
                    +380 67 112 77 33
                  </a>
                  <span className="hidden sm:inline text-[#8D7665]">|</span>
                  <a
                    href="tel:+380631127733"
                    className="hover:text-white font-semibold transition-colors"
                  >
                    +380 63 112 77 33
                  </a>
                </div>
              </li>
            </ul>
          </div>

          {/* Колонка 3: Мережа DomaGroup & Вакансії */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-display text-lg font-bold text-white">
              DomaGroup & Мережа
            </h3>
            <ul className="space-y-2 text-sm text-[#D4C3AC]">
              <li>
                <a
                  href="/croissant/"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>🥐</span>
                  <span>Doma Croissants</span>
                </a>
              </li>
              <li>
                <a
                  href="/group/"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>🌐</span>
                  <span>Мережа DomaGroup</span>
                </a>
              </li>
              <li>
                <a
                  href="https://domagroup.com.ua/coop"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>🤝</span>
                  <span>Партнерство & Франшиза</span>
                </a>
              </li>
              <li>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSd89y1NvhZNHfuzBynttut1wk58yS1tmyK8VtkHcKnt3k56QA/viewform?usp=sf_link"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-300 text-amber-200 transition-colors flex items-center gap-1.5"
                >
                  <span>💼</span>
                  <span>Вакансії: робота в команді</span>
                </a>
              </li>
              <li className="pt-1">
                <a
                  href="https://domagroup.com.ua/offer"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#8D7665] hover:text-[#B8A796] underline"
                >
                  Публічний договір (оферта)
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Нижній копірайт */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8D7665]">
          <div>
            © {new Date().getFullYear()} Doma Pizza & Sushi (Дома Піца та Суші). Усі права захищено.
          </div>
          <div>
            Перша швидка доставка задоволення • м. Вишгород
          </div>
        </div>
      </div>
    </footer>
  );
}
