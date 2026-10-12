interface CustomerInfoFieldsProps {
  name: string;
  setName: (v: string) => void;
  phone: string;
  onPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhoneKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  saveDetails: boolean;
  setSaveDetails: (v: boolean) => void;
  isAsap: boolean;
  setIsAsap: (v: boolean) => void;
  scheduledTime: string;
  setScheduledTime: (v: string) => void;
  paymentMethod: "cash" | "card";
  setPaymentMethod: (v: "cash" | "card") => void;
  comment: string;
  setComment: (v: string) => void;
  isPhoneVerified?: boolean;
}

export function CustomerInfoFields({
  name,
  setName,
  phone,
  onPhoneChange,
  onPhoneKeyDown,
  saveDetails,
  setSaveDetails,
  isAsap,
  setIsAsap,
  scheduledTime,
  setScheduledTime,
  paymentMethod,
  setPaymentMethod,
  comment,
  setComment,
  isPhoneVerified = false,
}: CustomerInfoFieldsProps) {
  return (
    <div className="space-y-5">
      {/* Контактні дані */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#6B533E] mb-1">
            Ваше ім'я *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Як до вас звертатися?"
            className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-[#6B533E]">
              Номер телефону *
            </label>
            {isPhoneVerified && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                ✓ Верифіковано
              </span>
            )}
          </div>
          <input
            type="tel"
            required
            value={phone}
            onChange={onPhoneChange}
            onKeyDown={onPhoneKeyDown}
            disabled={isPhoneVerified}
            placeholder="+380 (XX) XXX-XX-XX"
            className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-tight ${
              isPhoneVerified
                ? "bg-[#F5EFE6] border-[#D8C7B0] text-[#4A3B32] opacity-90 cursor-not-allowed"
                : "bg-white border-[#D8C7B0] focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
            }`}
          />
        </div>
      </div>

      {/* Чекбокс запам'ятати мої дані */}
      <label className="flex items-center gap-2.5 text-xs text-[#6B533E] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={saveDetails}
          onChange={(e) => setSaveDetails(e.target.checked)}
          className="accent-[#C8823E] w-4 h-4 rounded"
        />
        <span>Запам'ятати мої контактні дані для наступних замовлень</span>
      </label>

      {/* Час отримання */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#7A695C]">
          Час отримання
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-[#2C1E14] cursor-pointer">
            <input
              type="radio"
              name="time_type"
              checked={isAsap}
              onChange={() => setIsAsap(true)}
              className="accent-[#C8823E]"
            />
            <span>Якнайшвидше (від 30 хв)</span>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-[#2C1E14] cursor-pointer">
            <input
              type="radio"
              name="time_type"
              checked={!isAsap}
              onChange={() => setIsAsap(false)}
              className="accent-[#C8823E]"
            />
            <span>На певний час</span>
          </label>
        </div>
        {!isAsap && (
          <input
            type="text"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            placeholder="Наприклад: 14:30 або на завтра 09:00"
            className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
          />
        )}
      </div>

      {/* Спосіб оплати */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#7A695C]">
          Спосіб оплати
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            className={`p-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              paymentMethod === "cash"
                ? "border-[#C8823E] bg-[#FFF8EE] text-[#2C1E14] ring-2 ring-[#C8823E]/20"
                : "border-[#EADFCF] bg-white text-[#6B533E]"
            }`}
          >
            <span>💵</span>
            <span>Готівка</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("card")}
            className={`p-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              paymentMethod === "card"
                ? "border-[#C8823E] bg-[#FFF8EE] text-[#2C1E14] ring-2 ring-[#C8823E]/20"
                : "border-[#EADFCF] bg-white text-[#6B533E]"
            }`}
          >
            <span>💳</span>
            <span>Карткою при отриманні</span>
          </button>
        </div>
      </div>

      {/* Коментар */}
      <div>
        <label className="block text-xs font-bold text-[#6B533E] mb-1">
          Коментар до замовлення
        </label>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Побажання щодо пакування, код домофону тощо..."
          className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
        />
      </div>
    </div>
  );
}

