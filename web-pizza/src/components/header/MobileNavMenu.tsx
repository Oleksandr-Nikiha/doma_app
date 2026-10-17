import { UserAvatar } from "../ui/UserAvatar.tsx";

interface MobileNavMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeNavId?: string | number | null;
  onSelectNav?: (id: string | number) => void;
  lastOrderId?: number | null;
  onOpenTracking?: () => void;
  onOpenCabinet?: () => void;
  userName?: string | null;
  userAvatarUrl?: string | null;
  isAuthenticated?: boolean;
}

export function MobileNavMenu({
  isOpen,
  onClose,
  activeNavId,
  onSelectNav,
  lastOrderId,
  onOpenTracking,
  onOpenCabinet,
  userName,
  userAvatarUrl,
  isAuthenticated = false,
}: MobileNavMenuProps) {
  if (!isOpen) return null;

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    onClose();
    if (onSelectNav) {
      onSelectNav(targetId);
      return;
    }
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks = [
    { id: "menu", label: "Меню", icon: "🍕" },
    { id: "about", label: "Про ресторан", icon: "📖" },
    { id: "delivery", label: "Доставка та оплата", icon: "🛵" },
    { id: "careers", label: "Вакансії", icon: "💼" },
    { id: "contacts", label: "Контакти", icon: "📍" },
  ];

  return (
    <div className="md:hidden border-t border-white/10 bg-[#14171E] p-4 shadow-2xl animate-in slide-in-from-top-4 duration-200">
      {/* Кнопка особистого кабінету у мобільному меню */}
      {onOpenCabinet && (
        <div className="mb-2.5">
          <button
            onClick={() => {
              onClose();
              onOpenCabinet();
            }}
            type="button"
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1A1D24] border border-white/10 text-[#F1F5F9] font-bold text-xs active:scale-98 transition-transform shadow-xs cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              {isAuthenticated ? (
                <>
                  <UserAvatar avatarUrl={userAvatarUrl} name={userName} size="sm" />
                  <span>{userName ? `Кабінет (${userName.split(" ")[0]})` : "Особистий кабінет"}</span>
                </>
              ) : (
                <>
                  <span className="text-base">👤</span>
                  <span>Особистий кабінет</span>
                </>
              )}
            </span>
            <span className="text-xs text-[#E2583E] font-bold">
              {isAuthenticated ? "Мій профіль →" : "Увійти →"}
            </span>
          </button>
        </div>
      )}

      {/* Кнопка швидкого трекінгу у мобільному меню */}
      {lastOrderId && onOpenTracking && (
        <div className="mb-3">
          <button
            onClick={() => {
              onClose();
              onOpenTracking();
            }}
            type="button"
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1E232B] border border-white/10 text-[#F1F5F9] font-bold text-xs active:scale-98 transition-transform shadow-xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Активне замовлення #{lastOrderId}</span>
            </span>
            <span className="text-xs text-[#E2583E] font-bold">Відстежити ➔</span>
          </button>
        </div>
      )}

      {/* Навігаційні посилання */}
      <div className="flex flex-col gap-1">
        {navLinks.map((link) => {
          const isActive = activeNavId === link.id;
          return (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => handleLinkClick(e, link.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                isActive
                  ? "bg-[#D34528] text-white shadow-xs"
                  : "text-[#94A3B8] hover:bg-[#1A1D24] hover:text-white"
              }`}
            >
              <span className="text-base">{link.icon}</span>
              <span>{link.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
