export function GroupFooter() {
  const logoSrc = `${import.meta.env.BASE_URL}logo-white.png`;

  return (
    <footer id="contacts" className="bg-[#2C1E14] text-[#E8DFC8] pt-16 pb-12 border-t border-[#3D2C1F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#4A3B32]">
          {/* Бренд */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={logoSrc}
                alt="DomaGroup"
                className="h-9 sm:h-10 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="font-display text-2xl font-bold text-white tracking-tight">
                DomaGroup Inc.
              </span>
            </div>
            <p className="text-xs uppercase text-[#E29E57] tracking-wider font-bold">
              Задоволення в усьому
            </p>
            <p className="text-sm text-[#B8A796] leading-relaxed">
              Мережа сучасних закладів смаку та гостинності у Вишгороді.
              Doma Pizza & Sushi, Doma Croissants та бонусна програма DomaClub.
            </p>
            <div className="pt-1 text-xs text-[#8D7665]">
              Email:{" "}
              <a href="mailto:domagroup.inc@gmail.com" className="text-[#D4C3AC] underline hover:text-white">
                domagroup.inc@gmail.com
              </a>
            </div>
          </div>

          {/* Заклад 1 */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-display text-base font-bold text-white flex items-center gap-2">
              <span>🍕🍣</span>
              <span>Doma Pizza & Sushi</span>
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#D4C3AC]">
              <li>📍 м. Вишгород, вул. Набережна, 8Д</li>
              <li>⏰ Графік & Доставка: 10:30 – 21:30</li>
              <li>
                📞{" "}
                <a href="tel:+380671127733" className="hover:text-white underline">
                  +380 67 112 77 33
                </a>{" "}
                /{" "}
                <a href="tel:+380631127733" className="hover:text-white underline">
                  +380 63 112 77 33
                </a>
              </li>
              <li className="pt-1">
                <a
                  href="/pizza/"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-300 font-bold hover:underline"
                >
                  Відкрити меню та замовити піцу →
                </a>
              </li>
            </ul>
          </div>

          {/* Заклад 2 */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-display text-base font-bold text-white flex items-center gap-2">
              <span>🥐☕</span>
              <span>Doma Croissants</span>
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#D4C3AC]">
              <li>📍 м. Вишгород, просп. Шевченка, 2Д</li>
              <li>⏰ Пекарня: 08:00 – 20:00 (Доставка з 10:00)</li>
              <li>
                📞{" "}
                <a href="tel:+380931127733" className="hover:text-white underline">
                  +380 93 112 77 33
                </a>
              </li>
              <li className="pt-1">
                <a
                  href="/croissant/"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-300 font-bold hover:underline"
                >
                  Відкрити меню та замовити круасани →
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Копірайт та юридичні лінки */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8D7665]">
          <div>
            © {new Date().getFullYear()} DomaGroup Inc. Усі права захищено.
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://domagroup.com.ua/offer"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#D4C3AC] underline"
            >
              Публічний договір (оферта)
            </a>
            <span>•</span>
            <a
              href="https://domagroup.com.ua/privacy"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#D4C3AC] underline"
            >
              Конфіденційність
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
