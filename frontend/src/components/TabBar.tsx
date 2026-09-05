import { NavLink } from "react-router-dom";

import { useCart } from "@/api/queries";
import { haptic } from "@/telegram/sdk";

const TABS = [
  { to: "/", icon: "🍕", label: "Меню" },
  { to: "/cart", icon: "🛒", label: "Кошик" },
  { to: "/contacts", icon: "📍", label: "Контакти" },
];

export function TabBar() {
  // Кошик уже в кеші після інших екранів — тут лише читаємо кількість для бейджа
  const { data: cart } = useCart();
  const count = cart?.items.reduce((sum, i) => sum + i.qty, 0) ?? 0;

  return (
    <nav
      className="sticky bottom-0 flex border-t"
      style={{
        // Напівпрозора з розмиттям: контент, що проїжджає під панеллю,
        // натякає, що список продовжується, а не обрізаний
        background: "var(--app-veil)",
        backdropFilter: "blur(12px)",
        borderColor: "var(--app-border)",
        // Щоб панель не ховалась під системним індикатором на iPhone
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          onClick={() => haptic("light")}
          className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs"
          style={({ isActive }) => ({
            color: isActive ? "var(--tg-theme-button-color)" : "var(--tg-theme-hint-color)",
          })}
        >
          <span className="text-xl leading-none">{tab.icon}</span>
          {tab.label}
          {tab.to === "/cart" && count > 0 && (
            <span
              key={count} /* перемонтування на зміні — щоб app-pop програвався щоразу */
              className="app-pop absolute right-[22%] top-1 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              {count}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
