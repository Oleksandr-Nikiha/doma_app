import { useEffect, useState } from "react";
import type { DeliveryAddress } from "../../types/catalog.ts";
import type { UserProfile } from "../../types/user.ts";
import {
  formatPhoneOnInput,
  handlePhoneKeyDown,
  formatPhoneNumber,
  isValidUkrainianPhone,
  normalizeE164Phone,
} from "../../utils/phone.ts";
import { type TelegramUser } from "./TelegramLoginWidget.tsx";

interface ProfileSettingsTabProps {
  profile: UserProfile;
  ordersCount: number;
  activeOrdersCount: number;
  streetsList: DeliveryAddress[];
  onOpenOrders: () => void;
  onOpenLoyalty?: () => void;
  onSaveProfile: (updated: UserProfile) => void;
  onLogout: () => void;
  onOpenPhoneAuth?: () => void;
  onTelegramAuth?: (user: TelegramUser) => void;
  onDisconnectTelegram?: () => void;
}

export function ProfileSettingsTab({
  profile,
  ordersCount,
  activeOrdersCount,
  streetsList,
  onOpenOrders,
  onOpenLoyalty,
  onSaveProfile,
  onLogout,
  onOpenPhoneAuth,
  onDisconnectTelegram,
}: ProfileSettingsTabProps) {
  // Розбиваємо повне ім'я на прізвище та ім'я
  const initialFirstName = profile.first_name || profile.name.split(" ")[0] || "";
  const initialLastName =
    profile.last_name || (profile.name.includes(" ") ? profile.name.split(" ").slice(1).join(" ") : "");

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(formatPhoneNumber(profile.phone));
  const [street, setStreet] = useState(profile.street);
  const [house, setHouse] = useState(profile.house);
  const [apartment, setApartment] = useState(profile.apartment);
  const [additionalAddress, setAdditionalAddress] = useState(profile.additional_address || "");

  const [isEditingMainAddress, setIsEditingMainAddress] = useState(!profile.street);
  const [isEditingAdditionalAddress, setIsEditingAdditionalAddress] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile.first_name || profile.name.split(" ")[0] || "");
    setLastName(
      profile.last_name || (profile.name.includes(" ") ? profile.name.split(" ").slice(1).join(" ") : ""),
    );
    setPhone(formatPhoneNumber(profile.phone));
    setStreet(profile.street);
    setHouse(profile.house);
    setApartment(profile.apartment);
    setAdditionalAddress(profile.additional_address || "");
  }, [profile]);

  const formatActiveBadge = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) {
      return `${count} активне`;
    }
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return `${count} активні`;
    }
    return `${count} активних`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneOnInput(e.target.value, phone);
    setPhone(formatted);
  };

  const fullDeliveryAddress = [street, house ? `буд. ${house}` : "", apartment ? `кв. ${apartment}` : ""]
    .filter(Boolean)
    .join(", ");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("Вкажіть ваше ім'я");
      return;
    }

    if (phone && !isValidUkrainianPhone(phone)) {
      setError("Вкажіть коректний мобільний номер (+380...)");
      return;
    }

    const cleanPhone = phone ? normalizeE164Phone(phone) : "";
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const isPhoneVerified = Boolean(profile.is_phone_verified || profile.telegram_id);

    const updated: UserProfile = {
      ...profile,
      name: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim() || undefined,
      phone: cleanPhone,
      street: street.trim(),
      house: house.trim(),
      apartment: apartment.trim(),
      additional_address: additionalAddress.trim() || undefined,
      is_phone_verified: isPhoneVerified,
      client_code: profile.client_code || `DM-${profile.telegram_id || "77"}`,
    };

    onSaveProfile(updated);
    setSavedSuccess(true);
    setIsEditingMainAddress(false);
    setIsEditingAdditionalAddress(false);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const clientCode = profile.client_code || `DM-${profile.telegram_id || "77"}`;
  const bonusBalance = profile.bonuses ?? 50;

  return (
    <form onSubmit={handleSave} className="space-y-5 animate-in fade-in duration-150">
      {savedSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-2">
          <span>✓</span>
          <span>Дані успішно збережено</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Секція: Мої замовлення (Ідентична до TG WebApp) */}
      <section>
        <div
          onClick={onOpenOrders}
          className="flex items-center justify-between rounded-2xl p-4 cursor-pointer transition-all bg-white border border-[#EADFCF] hover:border-[#C8823E]/50 shadow-2xs group"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl bg-[#F7F2EB] group-hover:scale-105 transition-transform">
              📦
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[#2C1E14]">Мої замовлення</p>
                {activeOrdersCount > 0 ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    {formatActiveBadge(activeOrdersCount)}
                  </span>
                ) : ordersCount > 0 ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#F3EDE2] text-[#6B533E]">
                    {ordersCount}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[#7A695C] mt-0.5">
                {ordersCount > 0
                  ? `Історія та статус ${ordersCount} ${ordersCount === 1 ? "замовлення" : "замовлень"}`
                  : "Історія та статус замовлень"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#C8823E] font-bold text-sm group-hover:translate-x-1 transition-transform">
            <span>Переглянути</span>
            <span>→</span>
          </div>
        </div>
      </section>

      {/* Секція 1: Мої дані (Ідентично до TG WebApp) */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[#8D7B6D] px-1">
          Мої дані
        </p>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#EADFCF] space-y-3.5 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#6B533E] mb-1">
                Прізвище
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Шевченко"
                className="w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6B533E] mb-1">
                Імʼя *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Олександр"
                className="w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
              />
            </div>
          </div>

          {/* Номер телефону з бейджем верифікації */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B533E]">№ Телефону</span>
              {profile.is_phone_verified || Boolean(profile.telegram_id) ? (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  ✓ Верифіковано (🔒 закріплено)
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                  ⚠️ Не верифіковано
                </span>
              )}
            </div>

            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={handlePhoneKeyDown}
              disabled={Boolean(profile.is_phone_verified || profile.telegram_id)}
              placeholder="+380 (XX) XXX-XX-XX"
              className={`w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-tight ${
                profile.is_phone_verified || Boolean(profile.telegram_id)
                  ? "opacity-75 cursor-not-allowed bg-[#F5EFE6]"
                  : "focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
              }`}
            />

            {!(profile.is_phone_verified || Boolean(profile.telegram_id)) && (
              <div className="rounded-xl p-3 bg-amber-50/90 border border-amber-200/90 text-xs text-amber-900 space-y-2 mt-2 shadow-2xs">
                <p className="leading-relaxed text-[11px]">
                  Номер не верифіковано. Ви можете змінити його вище та зберегти профіль, або підтвердити поточний номер через наш Telegram-бот.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="https://t.me/ncoffee_app_tst_bot?start=verify_phone"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <span>📱</span>
                    <span>Підтвердити телефон у боті →</span>
                  </a>
                  {onOpenPhoneAuth && (
                    <button
                      type="button"
                      onClick={onOpenPhoneAuth}
                      className="flex items-center gap-1 bg-white border border-[#D8C7B0] text-[#6B533E] hover:text-[#2C1E14] px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      <span>🔑</span>
                      <span>Вхід за кодом / паролем</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Секція 2: Мої адреси доставки (Ідентично до TG WebApp) */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[#8D7B6D] px-1">
          Мої адреси доставки
        </p>

        <div className="space-y-3">
          {/* 1. Основна адреса */}
          {isEditingMainAddress ? (
            <div className="bg-white rounded-2xl border border-[#EADFCF] p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b pb-2 border-[#F0E6D8]">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">📍</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B533E]">
                    Основна адреса доставки (м. Вишгород)
                  </span>
                </div>
                {street && (
                  <button
                    type="button"
                    onClick={() => setIsEditingMainAddress(false)}
                    className="text-xs font-semibold text-[#9C5B23] hover:underline cursor-pointer"
                  >
                    Згорнути ✕
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B533E] mb-1">
                  Вулиця
                </label>
                <input
                  type="text"
                  list="cabinet-streets-datalist"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Введіть або оберіть вулицю..."
                  className="w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
                />
                <datalist id="cabinet-streets-datalist">
                  {streetsList.map((s) => (
                    <option key={s.id} value={s.street} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#6B533E] mb-1">
                    Будинок
                  </label>
                  <input
                    type="text"
                    value={house}
                    onChange={(e) => setHouse(e.target.value)}
                    placeholder="Напр. 15, 2Д"
                    className="w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B533E] mb-1">
                    Квартира / Офіс
                  </label>
                  <input
                    type="text"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="Опціонально"
                    className="w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white flex items-center justify-between rounded-2xl p-3.5 border border-[#EADFCF] shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">
                  📍
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#8D7B6D]">
                      Основна адреса
                    </span>
                    {fullDeliveryAddress ? (
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                        Збережено
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.2 text-[10px] font-semibold text-amber-700">
                        Не вказано
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-[#2C1E14] truncate">
                    {fullDeliveryAddress || "Вкажіть адресу для швидкого замовлення"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingMainAddress(true)}
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border border-[#D8C7B0] bg-[#FAF7F2] hover:bg-[#F3EDE2] text-[#9C5B23] cursor-pointer"
              >
                {fullDeliveryAddress ? "Змінити" : "+ Додати"}
              </button>
            </div>
          )}

          {/* 2. Додаткова адреса */}
          {isEditingAdditionalAddress ? (
            <div className="bg-white rounded-2xl border border-[#EADFCF] p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b pb-2 border-[#F0E6D8]">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🏢</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B533E]">
                    Додаткова адреса (робота, рідні)
                  </span>
                </div>
                {additionalAddress && (
                  <button
                    type="button"
                    onClick={() => setIsEditingAdditionalAddress(false)}
                    className="text-xs font-semibold text-[#9C5B23] hover:underline cursor-pointer"
                  >
                    Згорнути ✕
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B533E] mb-1">
                  Адреса
                </label>
                <input
                  type="text"
                  value={additionalAddress}
                  onChange={(e) => setAdditionalAddress(e.target.value)}
                  placeholder="Напр. м. Вишгород, вул. Набережна, 4, офіс 12"
                  className="w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
                />
              </div>
            </div>
          ) : (
            <div className="bg-white flex items-center justify-between rounded-2xl p-3.5 border border-[#EADFCF] shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-lg text-purple-600">
                  🏢
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#8D7B6D]">
                      Додаткова адреса
                    </span>
                    {additionalAddress ? (
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                        Збережено
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-semibold text-slate-600">
                        Не вказано
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-[#2C1E14] truncate">
                    {additionalAddress || "Офіс, робота або адреса рідних"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingAdditionalAddress(true)}
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border border-[#D8C7B0] bg-[#FAF7F2] hover:bg-[#F3EDE2] text-[#9C5B23] cursor-pointer"
              >
                {additionalAddress ? "Змінити" : "+ Додати"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Секція 3: Картка клієнта (Ідентично до TG WebApp) */}
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#8D7B6D] px-1">
          Картка клієнта
        </p>

        <div
          onClick={onOpenLoyalty}
          role={onOpenLoyalty ? "button" : undefined}
          tabIndex={onOpenLoyalty ? 0 : undefined}
          onKeyDown={onOpenLoyalty ? (e) => (e.key === "Enter" || e.key === " " ? onOpenLoyalty() : null) : undefined}
          className={`relative overflow-hidden rounded-3xl p-5 shadow-lg bg-gradient-to-br from-[#2C1E14] via-[#4A3B32] to-[#2C1E14] text-white border border-[#5A4535] text-left ${
            onOpenLoyalty ? "cursor-pointer hover:border-[#E29E57]/60 hover:shadow-xl transition-all" : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#E29E57]">
                  DOMA CLUB
                </span>
                <span className="text-xs">✨</span>
              </div>
              <p className="mt-1 text-lg font-bold tracking-tight">
                {profile.name || "Гість клубу"}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-[#E29E57]/20 text-[#E29E57] border border-[#E29E57]/30">
              <span>●</span>
              <span>Active</span>
            </div>
          </div>

          <div className="mt-8 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-60">
                Номер картки
              </p>
              <p className="font-mono text-sm font-bold tracking-widest text-[#EADFCF]">
                {clientCode}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider opacity-60">
                Бонуси
              </p>
              <p className="text-xl font-extrabold text-[#E29E57]">
                {bonusBalance} <span className="text-xs font-semibold opacity-70">бал.</span>
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-2.5 flex items-center justify-between">
            <p className="text-[11px] opacity-60 leading-relaxed">
              Єдиний бонусний рахунок у мережі закладів DomaGroup.
            </p>
            {onOpenLoyalty && (
              <span className="text-[11px] font-bold text-[#E29E57] shrink-0 ml-2 hover:underline">
                Деталі →
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Кнопка збереження */}
      <div className="pt-2">
        <button
          type="submit"
          className="w-full bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-3 rounded-xl font-bold text-sm shadow-md transition-transform active:scale-95 cursor-pointer"
        >
          Зберегти зміни
        </button>
      </div>

      {/* Дії облікового запису */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#EADFCF] text-xs">
        <button
          type="button"
          onClick={onLogout}
          className="text-red-600 hover:text-red-700 font-semibold cursor-pointer"
        >
          Вийти з профілю
        </button>

        {profile.telegram_id ? (
          <button
            type="button"
            onClick={onDisconnectTelegram}
            className="text-zinc-500 hover:text-zinc-700 font-semibold cursor-pointer"
          >
            Від'єднати Telegram (@{profile.username || profile.telegram_id})
          </button>
        ) : onOpenPhoneAuth ? (
          <button
            type="button"
            onClick={onOpenPhoneAuth}
            className="text-[#9C5B23] hover:underline font-bold cursor-pointer"
          >
            Увійти через інший акаунт →
          </button>
        ) : null}
      </div>
    </form>
  );
}
