import { DEFAULT_PRODUCT_IMAGE, getImageUrl } from "../api/client.ts";
import type { ProductListItem } from "../types/catalog.ts";

interface ProductCardProps {
  product: ProductListItem;
  onSelect: (productId: number) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const isSushi = Boolean(
    product.category_name &&
      /суші|рол|сет|sushi|roll/i.test(product.category_name),
  );

  return (
    <div
      onClick={() => onSelect(product.id)}
      className="group bg-[#181B22]/90 backdrop-blur-xs rounded-2xl border border-white/10 hover:border-white/20 overflow-hidden shadow-md hover:shadow-2xl hover:shadow-black/60 transition-all duration-300 flex flex-col cursor-pointer hover:-translate-y-1 active:scale-[0.98]"
    >
      {/* Зображення страви */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#121419]">
        <img
          src={getImageUrl(product.image_url)}
          alt={product.name}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
          }}
          className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500 opacity-90 group-hover:opacity-100"
        />
        {product.category_name && (
          <div
            className={`absolute top-2 right-2 backdrop-blur-md px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold shadow-xs truncate max-w-[85%] border ${
              isSushi
                ? "bg-[#1E3A2F]/90 text-emerald-300 border-emerald-500/30"
                : "bg-[#251512]/90 text-[#E2583E] border-[#D34528]/35"
            }`}
          >
            {product.category_name}
          </div>
        )}
      </div>

      {/* Тіло картки */}
      <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between space-y-2 sm:space-y-3">
        <div>
          <h3
            className={`font-display text-sm sm:text-xl font-bold text-[#F1F5F9] transition-colors leading-snug line-clamp-2 min-h-[2.5rem] sm:min-h-0 ${
              isSushi ? "group-hover:text-emerald-400" : "group-hover:text-[#E2583E]"
            }`}
          >
            {product.name}
          </h3>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10 gap-1.5">
          <div>
            <div className="text-[10px] sm:text-[11px] text-[#94A3B8] uppercase font-semibold leading-none mb-0.5">
              Ціна від
            </div>
            <div className="text-base sm:text-xl font-extrabold text-[#F8FAFC]">
              {product.price_from} <span className="text-xs sm:text-sm font-semibold text-[#94A3B8]">₴</span>
            </div>
          </div>

          <button
            type="button"
            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1 shrink-0 ${
              isSushi
                ? "bg-[#1E3A2F]/40 group-hover:bg-[#1E3A2F] text-emerald-300 group-hover:text-white border border-emerald-500/30"
                : "bg-[#D34528]/20 group-hover:bg-[#D34528] text-[#E2583E] group-hover:text-white border border-[#D34528]/30 shadow-xs"
            }`}
          >
            <span className="hidden xs:inline">Обрати</span>
            <span className="text-sm sm:text-base leading-none font-bold">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}
