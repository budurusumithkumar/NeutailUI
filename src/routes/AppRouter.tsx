import { Navigate, Route, Routes } from "react-router-dom";
import { CartScreen } from "../screens/Cart/CartScreen";
import { ChatScreen } from "../screens/Chat/ChatScreen";
import { HomeScreen } from "../screens/Home/HomeScreen";
import { LoginScreen } from "../screens/Login/LoginScreen";
import { ProfileScreen } from "../screens/Profile/ProfileScreen";
import { TryOnScreen } from "../screens/TryOn/TryOnScreen";
import { TryOn3DScreen } from "../screens/TryOn3D/TryOn3DScreen";
import { RequireAuth } from "./RequireAuth";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomeScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/chat"
        element={
          <RequireAuth>
            <ChatScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/try-on"
        element={
          <RequireAuth>
            <TryOnScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/try-on-3d"
        element={
          <RequireAuth>
            <TryOn3DScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/cart"
        element={
          <RequireAuth>
            <CartScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfileScreen />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
