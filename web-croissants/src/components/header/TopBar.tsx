import { getWorkingHoursInfo } from "../../utils/workingHours.ts";

interface TopBarProps {
  phone: string;
  address: string;
}

export function TopBar({ phone, address }: TopBarProps) {
  const hoursInfo = getWorkingHoursInfo();

  return (
    <div className="bg-[#0B0D10] text-[#94A3B8] text-xs py-1.5 px-3 sm:px-4 border-b border-white/5">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
        {/* Ліва частина: статус графіку */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                hoursInfo.badgeColor === "emerald"
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-amber-400"
              }`}
            />
            {/* Короткий текст для мобільних */}
            <span className="text-[#F1F5F9] font-semibold sm:hidden whitespace-nowrap text-[11px]">
              {hoursInfo.shortStatusText}
            </span>
            {/* Повний текст для екранів від sm */}
            <span className="text-[#F1F5F9] font-medium hidden sm:inline whitespace-nowrap">
              {hoursInfo.statusText}
            </span>
          </span>

          <span className="text-white/20 hidden md:inline">|</span>
          <span className="hidden md:inline-flex items-center gap-1 text-[#94A3B8] shrink-0">
            🛵 Доставка: 10:00 – 21:00 (від 250 ₴ безкоштовно)
          </span>
          <span className="hidden lg:inline-block text-white/20">|</span>
          <a
            href="https://maps.app.goo.gl/jeX4BLChZar5k1so6"
            target="_blank"
            rel="noreferrer"
            className="hidden lg:inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#E69A38] transition-colors truncate"
            title="Відкрити на мапі Google Maps"
          >
            📍 {address}
          </a>
        </div>

        {/* Права частина: контакти */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#E69A38] transition-colors"
          >
            <span>📷</span>
            <span className="hidden md:inline">@urbanbakery.coffee</span>
          </a>
          <span className="hidden sm:inline-block text-white/20">|</span>
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="font-bold sm:font-medium text-[11px] sm:text-xs text-[#CBD5E1] hover:text-white transition-colors whitespace-nowrap"
          >
            📞 {phone}
          </a>
          <a
            href="https://t.me/ncoffee_app_tst_bot"
            target="_blank"
            rel="noreferrer"
            className="hidden xl:inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
          >
            📱 Urban Bites Bot
          </a>
        </div>
      </div>
    </div>
  );
}

