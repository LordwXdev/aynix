import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { RealtimeProvider } from "./realtime/socket";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Live } from "./pages/Live";
import { Orders } from "./pages/Orders";
import { Deliveries } from "./pages/Deliveries";
import { Stores } from "./pages/Stores";
import { Drivers } from "./pages/Drivers";
import { Users } from "./pages/Users";
import { Categories } from "./pages/Categories";

const Routed = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="login-page muted">Loading…</div>;
  if (!user) return <Login />;

  return (
    <RealtimeProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="live" element={<Live />} />
          <Route path="orders" element={<Orders />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="stores" element={<Stores />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="users" element={<Users />} />
          <Route path="categories" element={<Categories />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  );
};

export const App = () => (
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        <Routed />
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);
