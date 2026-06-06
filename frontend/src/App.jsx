import { Navigate, Route, Routes } from "react-router-dom";
import AdminRoute from "./components/AdminRoute";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import Accounts from "./pages/Accounts";
import Calendar from "./pages/Calendar";
import Cards from "./pages/Cards";
import Categories from "./pages/Categories";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Transactions from "./pages/Transactions";

// 로그인 필요 + 공통 레이아웃 래퍼
function Protected({ children }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/calendar" element={<Protected><Calendar /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
      <Route path="/categories" element={<Protected><Categories /></Protected>} />
      <Route path="/cards" element={<Protected><Cards /></Protected>} />
      <Route path="/accounts" element={<Protected><Accounts /></Protected>} />

      {/* 관리자 전용 */}
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <AdminRoute>
              <Layout>
                <Settings />
              </Layout>
            </AdminRoute>
          </PrivateRoute>
        }
      />

      <Route path="/" element={<Navigate to="/calendar" replace />} />
      <Route path="*" element={<Navigate to="/calendar" replace />} />
    </Routes>
  );
}
