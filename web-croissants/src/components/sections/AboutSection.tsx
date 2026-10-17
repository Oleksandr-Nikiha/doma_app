export function AboutSection() {
  return (
    <section
      id="about"
      className="bg-transparent py-16 sm:py-20 border-t border-white/10"
      style={{
        scrollMarginTop:
          "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#E69A38] px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-white/10">
              <span>🥐</span>
              <span>Перша пекарня задоволення</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Urban Bakery & Coffee — справжня майстерня смаку
            </h2>
            <div className="space-y-4 text-[#94A3B8] leading-relaxed text-sm sm:text-base">
              <p>
                <strong className="text-[#F1F5F9]">Urban Bakery & Coffee</strong> – це сучасна міська пекарня та кав'ярня,
                що входить до гастрономічної родини Urban Bites разом із Urban Pizza & Sushi.
              </p>
              <p>
                Наша команда втілює культуру чесної випічки: добірне борошно, натуральна закваска, 100% вершкове масло
                та авторська обсмажка кавових зерен. Що б ви не обрали – хрусткий мигдалевий круасан,
                ситний сендвіч на крафтовому багеті чи ніжний десерт – це завжди безкомпромісна якість та щира турбота про гостя.
              </p>
              <p>
                Ми створюємо простір затишку у динамічному Києві: завітайте на ранкову каву,
                візьміть свіжу випічку додому або замовляйте швидку доставку по місту.
              </p>
            </div>

            {/* Ключові факти */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#E69A38]">
                  м. Київ
                </div>
                <div className="text-xs text-[#94A3B8] mt-0.5">Велика Васильківська, 24</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#E69A38]">
                  від 250 ₴
                </div>
                <div className="text-xs text-[#94A3B8] mt-0.5">Безкоштовна доставка</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#E69A38]">
                  08:00
                </div>
                <div className="text-xs text-[#94A3B8] mt-0.5">Свіжа випічка щоранку</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#E69A38]">
                  100%
                </div>
                <div className="text-xs text-[#94A3B8] mt-0.5">Натуральне масло</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl bg-[#181B22] border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80"
                alt="Круасани Urban Bakery"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 opacity-90 hover:opacity-100"
              />
            </div>
            <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl bg-[#181B22] border border-white/10 mt-8">
              <img
                src="https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80"
                alt="Кава та випічка"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 opacity-90 hover:opacity-100"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

