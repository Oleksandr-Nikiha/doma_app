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
          <span className="text-xs font-bold uppercase tracking-wider text-[#E69A38]">
            Швидко та смачно
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Доставка та самовивіз у Києві
          </h2>
          <p className="text-[#94A3B8] text-sm sm:text-base">
            Насолоджуйтесь хрусткими круасанами та гарячими стравами вдома, в офісі чи на прогулянці
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#181B22]/90 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-lg space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#252A34] text-[#E69A38] flex items-center justify-center text-2xl font-bold">
              🛵
            </div>
            <h3 className="font-display text-xl font-bold text-[#F1F5F9]">
              Кур'єрська доставка
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Працює щодня з <strong className="text-[#F1F5F9]">10:00 до 21:00</strong>. Доставка по м. Київ
              <strong className="text-[#F1F5F9]"> безкоштовна при замовленні від 250 ₴</strong>.
            </p>
            <div className="text-xs font-semibold text-[#64748B]">
              Замовлення:{" "}
              <a href="tel:+380442220022" className="text-[#E69A38] underline font-bold">
                +380 (44) 222-00-22
              </a>
            </div>
          </div>

          <div className="bg-[#181B22]/90 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-lg space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#252A34] text-[#E69A38] flex items-center justify-center text-2xl font-bold">
              🛍️
            </div>
            <h3 className="font-display text-xl font-bold text-[#F1F5F9]">
              Самовивіз без черги
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Пекарня працює щодня з <strong className="text-[#F1F5F9]">08:00 до 21:00</strong> за адресою:{" "}
              <a
                href="https://maps.app.goo.gl/jeX4BLChZar5k1so6"
                target="_blank"
                rel="noreferrer"
                className="font-bold underline text-[#E69A38] hover:underline transition-colors"
                title="Відкрити на мапі Google Maps"
              >
                вул. Велика Васильківська, 24
              </a>
              . Замовляйте на сайті заздалегідь.
            </p>
            <div className="text-xs font-semibold text-[#64748B]">
              Приготуємо свіжим до вашого приходу!
            </div>
          </div>

          <div className="bg-[#181B22]/90 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-lg space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#252A34] text-[#E69A38] flex items-center justify-center text-2xl font-bold">
              💳
            </div>
            <h3 className="font-display text-xl font-bold text-[#F1F5F9]">
              Зручна оплата
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Оплачуйте готівкою або банківською карткою кур'єру під час отримання,
              або на касі закладу під час самовивозу.
            </p>
            <div className="text-xs font-semibold text-[#64748B]">
              Безпечно, прозоро та швидко.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

