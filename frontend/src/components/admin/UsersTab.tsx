import { useState } from "react";
import {
  useAdminUsers,
  useUpdateAdminUser,
  useDeleteAdminUser,
} from "@/api/queries";
import type { AdminUser, Location } from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { ManagerModal } from "./ManagerModal";
import { haptic } from "@/telegram/sdk";

export function UsersTab({
  locations = [],
  isSuperAdmin = false,
}: {
  locations?: Location[];
  isSuperAdmin?: boolean;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const { data: users = [], isPending, error } = useAdminUsers(query);
  const [staffModalUser, setStaffModalUser] = useState<AdminUser | null>(null);

  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold">База клієнтів ({users.length})</h2>
        <p className="text-xs opacity-60">
          Пошук за номером телефону, ім'ям або Telegram ID, блокування та керування доступом
        </p>
      </div>

      {/* Пошук за номером телефону */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Номер телефону (+380...), ім'я або Telegram ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl p-3 pr-8 text-xs font-medium outline-none transition focus:ring-2 focus:ring-blue-500"
            style={{ background: "var(--app-surface-2)" }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setQuery("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm opacity-40 hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          className="app-press rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
          }}
        >
          🔍 Пошук
        </button>
      </form>

      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} />
      ) : users.length === 0 ? (
        <EmptyState
          icon="👤"
          title="Користувачів не знайдено"
          hint="Спробуйте змінити критерії пошуку"
        />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isSuperAdmin={isSuperAdmin}
              onToggleBlock={() => {
                const action = u.is_blocked ? "розблокувати" : "заблокувати";
                if (
                  window.confirm(
                    `Ви впевнені, що хочете ${action} користувача ${u.full_name}?`,
                  )
                ) {
                  updateUser.mutate({ userId: u.id, payload: { is_blocked: !u.is_blocked } });
                }
              }}
              onTogglePhoneVerified={() => {
                updateUser.mutate({
                  userId: u.id,
                  payload: { is_phone_verified: !u.is_phone_verified },
                });
              }}
              onSaveNote={(note) => {
                updateUser.mutate({ userId: u.id, payload: { admin_note: note } });
              }}
              onDelete={
                isSuperAdmin
                  ? () => {
                      if (
                        window.confirm(
                          `Видалити користувача ${u.full_name} (${u.phone})? Будуть видалені всі його дані та замовлення.`,
                        )
                      ) {
                        deleteUser.mutate(u.id);
                      }
                    }
                  : undefined
              }
              onPromoteToStaff={isSuperAdmin ? () => setStaffModalUser(u) : undefined}
              isUpdating={updateUser.isPending}
              isDeleting={deleteUser.isPending}
            />
          ))}
        </div>
      )}

      {isSuperAdmin && staffModalUser && (
        <ManagerModal
          manager={null}
          initialUser={staffModalUser}
          locations={locations}
          onClose={() => setStaffModalUser(null)}
        />
      )}
    </div>
  );
}

function UserCard({
  user,
  isSuperAdmin,
  onToggleBlock,
  onTogglePhoneVerified,
  onSaveNote,
  onDelete,
  onPromoteToStaff,
  isUpdating,
  isDeleting,
}: {
  user: AdminUser;
  isSuperAdmin?: boolean;
  onToggleBlock: () => void;
  onTogglePhoneVerified: () => void;
  onSaveNote: (note: string) => void;
  onDelete?: () => void;
  onPromoteToStaff?: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [note, setNote] = useState(user.admin_note || "");
  const [isNoteDirty, setIsNoteDirty] = useState(false);
  const [copiedTid, setCopiedTid] = useState(false);

  const handleCopyTid = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic("light");
    const tidStr = String(user.telegram_id);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(tidStr).then(() => {
        setCopiedTid(true);
        setTimeout(() => setCopiedTid(false), 2000);
      });
    } else {
      const el = document.createElement("textarea");
      el.value = tidStr;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedTid(true);
      setTimeout(() => setCopiedTid(false), 2000);
    }
  };

  return (
    <div
      className="app-card rounded-2xl p-4 transition-all"
      style={{
        border: user.is_blocked ? "1px solid #ef4444" : "1px solid var(--app-border)",
        background: user.is_blocked
          ? "color-mix(in srgb, #ef4444 6%, var(--app-surface))"
          : "var(--app-surface)",
      }}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-base shrink-0">{user.is_blocked ? "⛔" : "👤"}</span>
            <span className="text-sm font-bold break-words leading-snug" title={user.full_name}>
              {user.full_name}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: user.is_blocked
                  ? "color-mix(in srgb, #ef4444 20%, transparent)"
                  : "color-mix(in srgb, #10b981 20%, transparent)",
                color: user.is_blocked ? "#ef4444" : "#10b981",
              }}
            >
              {user.is_blocked ? "Заблоковано" : "Активний"}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: user.is_phone_verified
                  ? "color-mix(in srgb, #10b981 15%, transparent)"
                  : "color-mix(in srgb, #f59e0b 15%, transparent)",
                color: user.is_phone_verified ? "#059669" : "#d97706",
              }}
            >
              {user.is_phone_verified ? "✓ Верифіковано" : "⚠️ Не верифіковано"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs opacity-80">
            <a href={`tel:${user.phone}`} className="font-semibold text-blue-500 hover:underline">
              📞 {user.phone}
            </a>
            <button
              type="button"
              onClick={handleCopyTid}
              title="Натисніть, щоб скопіювати Telegram ID"
              className="app-press inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-mono font-semibold transition border cursor-pointer"
              style={{
                background: copiedTid
                  ? "color-mix(in srgb, #10b981 20%, var(--app-surface-2))"
                  : "var(--app-surface-2)",
                color: copiedTid ? "#10b981" : "inherit",
                borderColor: copiedTid ? "#10b981" : "var(--app-border)",
              }}
            >
              <span>🆔 {user.telegram_id}</span>
              <span className="text-[10px] font-sans font-medium">
                {copiedTid ? "✓ Скопійовано" : "📋"}
              </span>
            </button>
            <span>🛍️ Замовлень: {user.orders_count}</span>
            <span>📅 {user.created_at}</span>
          </div>
          {user.delivery_address && (
            <p className="mt-1 text-xs opacity-60 break-words">📍 Адреса: {user.delivery_address}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start justify-end">
          {onPromoteToStaff && (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                onPromoteToStaff();
              }}
              title="Призначити співробітником"
              className="app-press flex h-8 items-center justify-center gap-1 rounded-xl px-2 sm:px-2.5 text-xs font-semibold transition"
              style={{
                background: "color-mix(in srgb, #3b82f6 15%, transparent)",
                color: "#3b82f6",
              }}
            >
              <span>👔</span>
              <span className="hidden sm:inline">У персонал</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              haptic("light");
              const action = user.is_phone_verified
                ? "зняти верифікацію телефону"
                : "встановити верифікацію телефону";
              if (
                window.confirm(
                  `Ви впевнені, що хочете ${action} для клієнта ${user.full_name}? ${
                    user.is_phone_verified
                      ? "Клієнт зможе самостійно змінити свій номер у профілі."
                      : ""
                  }`,
                )
              ) {
                onTogglePhoneVerified();
              }
            }}
            disabled={isUpdating}
            title={
              user.is_phone_verified
                ? "Зняти верифікацію (дозволити клієнту змінити телефон)"
                : "Позначити телефон як верифікований"
            }
            className="app-press flex h-8 items-center justify-center gap-1 rounded-xl px-2 sm:px-2.5 text-xs font-semibold transition"
            style={{
              background: user.is_phone_verified
                ? "color-mix(in srgb, #f59e0b 15%, transparent)"
                : "color-mix(in srgb, #10b981 15%, transparent)",
              color: user.is_phone_verified ? "#d97706" : "#059669",
            }}
          >
            <span>{user.is_phone_verified ? "📱✕" : "📱✓"}</span>
            <span className="hidden sm:inline">
              {user.is_phone_verified ? "Зняти верифікацію" : "Верифікувати"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onToggleBlock();
            }}
            disabled={isUpdating}
            title={user.is_blocked ? "Розблокувати клієнта" : "Заблокувати клієнта"}
            className="app-press flex h-8 w-8 items-center justify-center rounded-xl text-sm transition"
            style={{
              background: user.is_blocked
                ? "color-mix(in srgb, #10b981 15%, transparent)"
                : "color-mix(in srgb, #ef4444 15%, transparent)",
              color: user.is_blocked ? "#10b981" : "#ef4444",
            }}
          >
            <span>{user.is_blocked ? "🔓" : "🚫"}</span>
          </button>
          {isSuperAdmin && onDelete && (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                onDelete();
              }}
              disabled={isDeleting}
              title="Видалити"
              className="app-press flex h-8 w-8 items-center justify-center rounded-xl text-sm transition opacity-80 hover:opacity-100"
              style={{
                background: "color-mix(in srgb, #ef4444 12%, var(--app-surface-2))",
                border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
              }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Поле примітки до профілю */}
      <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-semibold opacity-70">
            📝 Примітка до профілю (надходить менеджеру для підтвердження):
          </label>
          {isNoteDirty && (
            <button
              onClick={() => {
                haptic("medium");
                onSaveNote(note);
                setIsNoteDirty(false);
              }}
              disabled={isUpdating}
              className="app-press rounded-lg px-2 py-0.5 text-[11px] font-bold"
              style={{
                background: "var(--tg-theme-button-color)",
                color: "var(--tg-theme-button-text-color)",
              }}
            >
              Зберегти
            </button>
          )}
        </div>
        <textarea
          value={note}
          rows={2}
          placeholder="Наприклад: Постійний клієнт, просить не дзвонити у двері"
          onChange={(e) => {
            setNote(e.target.value);
            setIsNoteDirty(true);
          }}
          className="w-full rounded-xl p-2.5 text-xs outline-none transition focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--app-surface-2)" }}
        />
      </div>
    </div>
  );
}
