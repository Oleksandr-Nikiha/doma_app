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
    { id: "menu", label: "Меню", icon: "🥐" },
    { id: "about", label: "Про пекарню", icon: "📖" },
    { id: "delivery", label: "Доставка та оплата", icon: "🛵" },
    { id: "careers", label: "Вакансії", icon: "💼" },
    { id: "contacts", label: "Контакти", icon: "📍" },
  ];

  return (
    <div className="md:hidden border-t border-[#E8DFC8] bg-[#FAF7F2] p-4 shadow-lg animate-in slide-in-from-top-4 duration-200">
      {/* Кнопка особистого кабінету у мобільному меню */}
      {onOpenCabinet && (
        <div className="mb-2.5">
          <button
            onClick={() => {
              onClose();
              onOpenCabinet();
            }}
            type="button"
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-[#E2D5C3] text-[#2C1E14] font-bold text-xs active:scale-98 transition-transform shadow-xs cursor-pointer"
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
            <span className="text-xs text-[#9C5B23] font-bold">
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
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#FFF8EE] border border-[#E8DFC8] text-[#2C1E14] font-bold text-xs active:scale-98 transition-transform shadow-xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Активне замовлення #{lastOrderId}</span>
            </span>
            <span className="text-xs text-[#C8823E] font-bold">Відстежити ➔</span>
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
                  ? "bg-[#C8823E] text-white shadow-xs"
                  : "text-[#4A3B32] hover:bg-[#F3EDE2] hover:text-[#C8823E]"
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
