import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventarioSession } from "../../contexts/InventarioSessionContext.jsx";
import api, { isApiConfigured } from "../../lib/apiClient";

/**
 * Shared auth gate for inventario pages: uses cached user when available,
 * falls back to /auth/me only once per session.
 */
export function useInventarioPage() {
  const navigate = useNavigate();
  const { user, setUser, clearSession } = useInventarioSession();
  const [authChecked, setAuthChecked] = useState(() => Boolean(user && api.getToken()));

  useEffect(() => {
    if (!isApiConfigured) return;
    if (!api.getToken()) {
      navigate("/admin");
      return;
    }
    if (user) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (!cancelled) {
          setUser(me);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
          navigate("/admin");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, setUser, clearSession, navigate]);

  const signOut = async () => {
    try {
      await api.logout();
    } finally {
      clearSession();
      navigate("/admin");
    }
  };

  return { user, setUser, authChecked, navigate, signOut, clearSession };
}
