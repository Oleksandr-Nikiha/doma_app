import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useMe } from "@/api/queries";
import { Layout } from "@/components/Layout";
import { ErrorBox, Spinner } from "@/components/ui";
import { CartPage } from "@/pages/CartPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { OrderSuccessPage } from "@/pages/OrderSuccessPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ProductPage } from "@/pages/ProductPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RegisterPage } from "@/pages/RegisterPage";

// Адмінка важить 150 КБ і потрібна лише персоналу — завантажуємо окремим чанком
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));

export function App() {
  // /me віддає null, якщо користувача ще немає в БД — тоді показуємо онбординг.
  // Каталог технічно працює й без реєстрації, але кошик — ні, тож простіше
  // провести реєстрацію одразу на вході.
  const { data: user, isPending, error, refetch } = useMe();

  if (isPending) return <Spinner />;

  // 401 означає, що бекенд не визнав підпис initData. Для користувача це
  // виглядає як «застосунок зламався», хоча причина зовнішня: відкрито поза
  // Telegram, протух initData у розробці, або BOT_TOKEN на бекенді
  // не від того бота, з якого відкрили Mini App.
  if (error instanceof ApiError && error.status === 401) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <div className="text-5xl">🔒</div>
        <p className="mt-4 font-medium">Не вдалося підтвердити сесію</p>
        <p className="mt-2 text-sm opacity-60">
          Відкрийте застосунок через кнопку «Меню» в боті Doma.
        </p>
        <p className="mt-4 text-xs opacity-40">{error.detail}</p>
      </div>
    );
  }

  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
  if (!user) return <RegisterPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<CategoriesPage />} />
        <Route path="/categories/:categoryId" element={<ProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/orders" element={<OrdersPage />} />
      </Route>
      {/* Картка товару, чекаут, екран успіху та адмінка — без клієнтської нижньої панелі */}
      <Route
        path="/admin"
        element={
          <Suspense fallback={<Spinner />}>
            <AdminPage />
          </Suspense>
        }
      />
      <Route path="/products/:productId" element={<ProductPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/orders/:orderId/success" element={<OrderSuccessPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
