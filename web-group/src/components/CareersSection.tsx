export function CareersSection() {
  const jobs = [
    { title: "Піцайоло / Кухар піци", loc: "вул. Набережна, 8Д", type: "Повна зайнятість" },
    { title: "Сушист", loc: "вул. Набережна, 8Д", type: "Змінний графік" },
    { title: "Пекар-кондитер", loc: "просп. Шевченка, 2Д", type: "Ранкові зміни" },
    { title: "Бариста-касир", loc: "просп. Шевченка, 2Д", type: "Гнучкий графік" },
    { title: "Кур'єр на авто / скутері", loc: "м. Вишгород", type: "Щоденні виплати" },
  ];

  return (
    <section id="careers" className="py-16 sm:py-24 bg-white border-b border-[#EADFCF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C8823E]">
            Команда DomaGroup
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C1E14]">
            Кар'єра та робота в команді
          </h2>
          <p className="text-sm sm:text-base text-[#614F42]">
            Ми створюємо робоче середовище, де цінують майстерність, взаємоповагу та любов до своєї справи
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-3 mb-10">
          {jobs.map((j) => (
            <div
              key={j.title}
              className="bg-[#FAF7F2] p-4 sm:p-5 rounded-2xl border border-[#E8DFC8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#C8823E] transition-all"
            >
              <div>
                <h4 className="font-bold text-base text-[#2C1E14]">{j.title}</h4>
                <div className="text-xs text-[#7A695C] mt-0.5 flex items-center gap-2">
                  <span>📍 {j.loc}</span>
                  <span>•</span>
                  <span>⏰ {j.type}</span>
                </div>
              </div>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSd89y1NvhZNHfuzBynttut1wk58yS1tmyK8VtkHcKnt3k56QA/viewform?usp=sf_link"
                target="_blank"
                rel="noreferrer"
                className="bg-white hover:bg-[#F3EDE2] text-[#2C1E14] border border-[#D8C7B0] px-4 py-2 rounded-xl text-xs font-bold transition-colors self-start sm:self-center"
              >
                Відгукнутися →
              </a>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSd89y1NvhZNHfuzBynttut1wk58yS1tmyK8VtkHcKnt3k56QA/viewform?usp=sf_link"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95"
          >
            <span>💼</span>
            <span>Заповнити анкету кандидата</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
