import { getImageUrl } from "../api/client.ts";
import type { ProductListItem } from "../types/catalog.ts";

interface ProductCardProps {
  product: ProductListItem;
  onSelect: (productId: number) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <div
      onClick={() => onSelect(product.id)}
      className="group bg-white rounded-2xl border border-[#E8DFC8] overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer hover:-translate-y-1 active:scale-[0.98]"
    >
      {/* Зображення страви */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F3EDE2]">
        <img
          src={getImageUrl(product.image_url)}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80";
          }}
          className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
        />
        {product.category_name && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold text-[#6B533E] shadow-xs truncate max-w-[85%]">
            {product.category_name}
          </div>
        )}
      </div>

      {/* Тіло картки */}
      <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between space-y-2 sm:space-y-3">
        <div>
          <h3 className="font-display text-sm sm:text-xl font-bold text-[#2C1E14] group-hover:text-[#C8823E] transition-colors leading-snug line-clamp-2 min-h-[2.5rem] sm:min-h-0">
            {product.name}
          </h3>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#F5EFE6] gap-1.5">
          <div>
            <div className="text-[10px] sm:text-[11px] text-[#7A695C] uppercase font-semibold leading-none mb-0.5">
              Ціна від
            </div>
            <div className="text-base sm:text-xl font-extrabold text-[#2C1E14]">
              {product.price_from} <span className="text-xs sm:text-sm font-semibold">₴</span>
            </div>
          </div>

          <button
            type="button"
            className="bg-[#F3EDE2] group-hover:bg-[#C8823E] text-[#2C1E14] group-hover:text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1 shrink-0"
          >
            <span className="hidden xs:inline">Обрати</span>
            <span className="text-sm sm:text-base leading-none font-bold">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}
