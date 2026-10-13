export function DeliverySection() {
  return (
    <section
      id="delivery"
      className="bg-[#FAF7F2] py-16 sm:py-20 border-t border-[#EADFCF]"
      style={{
        scrollMarginTop:
          "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C85A32]">
            Швидко та гаряче
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#2C1E14]">
            Доставка та самовивіз у Вишгороді
          </h2>
          <p className="text-[#614F42] text-sm sm:text-base">
            Насолоджуйтесь гарячою піцою, свіжими суші-сетами та бургерами вдома або в офісі
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF8EE] text-[#C85A32] flex items-center justify-center text-2xl font-bold">
              🛵
            </div>
            <h3 className="font-display text-xl font-bold text-[#2C1E14]">
              Кур'єрська доставка
            </h3>
            <p className="text-sm text-[#614F42] leading-relaxed">
              Працює щодня з <strong>10:30 до 21:30</strong>. Доставка по м. Вишгород
              <strong> безкоштовна при замовленні від 250 ₴</strong>.
            </p>
            <div className="text-xs font-semibold text-[#8D7665]">
              Замовлення:{" "}
              <a href="tel:+380671127733" className="text-[#C85A32] underline font-bold">
                +380 67 112 77 33
              </a>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF8EE] text-[#C85A32] flex items-center justify-center text-2xl font-bold">
              🛍️
            </div>
            <h3 className="font-display text-xl font-bold text-[#2C1E14]">
              Самовивіз зі знижкою
            </h3>
            <p className="text-sm text-[#614F42] leading-relaxed">
              Заклад працює щодня з <strong>10:30 до 21:30</strong> за адресою:{" "}
              <a
                href="https://maps.app.goo.gl/BRLZFuPRPjxBUq3M9"
                target="_blank"
                rel="noreferrer"
                className="font-bold underline hover:text-[#C85A32] transition-colors"
                title="Відкрити на мапі міста"
              >
                вул. Набережна, 8Д
              </a>
              . Замовляйте на сайті заздалегідь.
            </p>
            <div className="text-xs font-semibold text-[#8D7665]">
              Приготуємо гарячим точно на зазначений час!
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF8EE] text-[#C85A32] flex items-center justify-center text-2xl font-bold">
              💳
            </div>
            <h3 className="font-display text-xl font-bold text-[#2C1E14]">
              Зручна оплата
            </h3>
            <p className="text-sm text-[#614F42] leading-relaxed">
              Оплачуйте готівкою або банківською карткою кур'єру під час отримання,
              або на касі закладу під час самовивозу.
            </p>
            <div className="text-xs font-semibold text-[#8D7665]">
              Зручно, прозоро та швидко.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
