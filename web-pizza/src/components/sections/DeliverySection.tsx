export function DeliverySection() {
  return (
    <section
      id="delivery"
      className="bg-transparent py-16 sm:py-20 border-t border-white/10"
      style={{
        scrollMarginTop:
          "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E2583E]">
            Швидко та гаряче
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Доставка та самовивіз у Києві
          </h2>
          <p className="text-[#94A3B8] text-sm sm:text-base">
            Насолоджуйтесь гарячою піцою, свіжими суші-сетами та бургер-боулами вдома або в офісі
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#181B22]/90 backdrop-blur-xs rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1E232B] text-[#E2583E] border border-white/10 flex items-center justify-center text-2xl font-bold">
              🛵
            </div>
            <h3 className="font-display text-xl font-bold text-white">
              Кур'єрська доставка
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Працює щодня з <strong className="text-white">10:30 до 21:30</strong>. Доставка по м. Київ
              <strong className="text-emerald-400"> безкоштовна при замовленні від 250 ₴</strong>.
            </p>
            <div className="text-xs font-semibold text-[#94A3B8]">
              Замовлення:{" "}
              <a href="tel:+380442220011" className="text-[#E2583E] underline font-bold">
                +380 (44) 222-00-11
              </a>
            </div>
          </div>

          <div className="bg-[#181B22]/90 backdrop-blur-xs rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1E232B] text-[#E2583E] border border-white/10 flex items-center justify-center text-2xl font-bold">
              🛍️
            </div>
            <h3 className="font-display text-xl font-bold text-white">
              Самовивіз зі знижкою
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Заклад працює щодня з <strong className="text-white">10:30 до 21:30</strong> за адресою:{" "}
              <a
                href="https://maps.app.goo.gl/BRLZFuPRPjxBUq3M9"
                target="_blank"
                rel="noreferrer"
                className="font-bold underline hover:text-[#E2583E] text-white transition-colors"
                title="Відкрити на мапі міста"
              >
                вул. Набережна, 12
              </a>
              . Замовляйте на сайті заздалегідь.
            </p>
            <div className="text-xs font-semibold text-[#94A3B8]">
              Приготуємо гарячим точно на зазначений час!
            </div>
          </div>

          <div className="bg-[#181B22]/90 backdrop-blur-xs rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1E232B] text-[#E2583E] border border-white/10 flex items-center justify-center text-2xl font-bold">
              💳
            </div>
            <h3 className="font-display text-xl font-bold text-white">
              Зручна оплата
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Оплачуйте готівкою або банківською карткою кур'єру під час отримання,
              або на касі закладу під час самовивозу.
            </p>
            <div className="text-xs font-semibold text-[#94A3B8]">
              Зручно, прозоро та швидко.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
