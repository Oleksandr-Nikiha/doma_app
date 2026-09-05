import { Navigate, Route, Routes } from "react-router-dom";

import { useMe } from "@/api/queries";
import { Layout } from "@/components/Layout";
import { ErrorBox, Spinner } from "@/components/ui";
import { CartPage } from "@/pages/CartPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { ProductPage } from "@/pages/ProductPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { RegisterPage } from "@/pages/RegisterPage";

export function App() {
  // /me віддає null, якщо користувача ще немає в БД — тоді показуємо онбординг.
  // Каталог технічно працює й без реєстрації, але кошик — ні, тож простіше
  // провести реєстрацію одразу на вході.
  const { data: user, isPending, error, refetch } = useMe();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
  if (!user) return <RegisterPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<CategoriesPage />} />
        <Route path="/categories/:categoryId" element={<ProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
      </Route>
      {/* Картка товару — на всю висоту, без нижньої панелі: там своя кнопка дії */}
      <Route path="/products/:productId" element={<ProductPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
