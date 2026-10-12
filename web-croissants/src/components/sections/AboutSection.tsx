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
            <div className="inline-flex items-center gap-2 bg-[#F3EDE2] text-[#9C5B23] px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
              <span>🥐</span>
              <span>Перша пекарня задоволення</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C1E14] leading-tight">
              Doma Croissants — справжня майстерня смаку
            </h2>
            <div className="space-y-4 text-[#614F42] leading-relaxed text-sm sm:text-base">
              <p>
                <strong className="text-[#2C1E14]">Doma Croissants</strong> – це справжня майстерня смаку,
                що втілює найкращі традиції відомого бренду Doma Pizza&Sushi.
              </p>
              <p>
                Наша команда спадкоємців кулінарних витворів мистецтва взяла найкраще з попередніх проектів,
                додала унікальний шарм та створила власний шедевр – великі хрусткі круасани.
                Що б ви обрали – витончений круасан з насиченою начинкою або класичний смак у непідвладному
                часу обличчі, у нас ви завжди знайдете ідеальний варіант за вигідною ціною.
              </p>
              <p>
                Наша історія розпочалася <strong className="text-[#2C1E14]">03.08.2023 року</strong> в нашому рідному місті –
                Вишгороді. Тут, серед джерел натхнення та творчого спалаху, ми зробили перший крок до створення
                неперевершеного досвіду смаку.
              </p>
            </div>

            {/* Ключові факти */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#EADFCF]">
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8823E]">
                  03.08.23
                </div>
                <div className="text-xs text-[#7A695C] mt-0.5">Рідне місто Вишгород</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8823E]">
                  від 250 ₴
                </div>
                <div className="text-xs text-[#7A695C] mt-0.5">Безкоштовна доставка</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8823E]">
                  08:00
                </div>
                <div className="text-xs text-[#7A695C] mt-0.5">Свіжа випічка щоранку</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8823E]">
                  100%
                </div>
                <div className="text-xs text-[#7A695C] mt-0.5">Натуральне масло</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl bg-[#FAF7F2]">
              <img
                src="https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80"
                alt="Круасани Doma"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl bg-[#FAF7F2] mt-8">
              <img
                src="https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80"
                alt="Кава та випічка"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

