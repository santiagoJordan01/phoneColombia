import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import api, { getStoredUser, setStoredUser } from "../lib/apiClient";
import { clearInventarioCache } from "../lib/inventarioCache.js";

const InventarioSessionContext = createContext(null);

export function InventarioSessionProvider({ children }) {
  const [user, setUserState] = useState(() => getStoredUser());

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);
    setStoredUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    setUserState(null);
    setStoredUser(null);
    clearInventarioCache();
    api.clearToken();
  }, []);

  const value = useMemo(
    () => ({ user, setUser, clearSession }),
    [user, setUser, clearSession],
  );

  return (
    <InventarioSessionContext.Provider value={value}>
      {children}
    </InventarioSessionContext.Provider>
  );
}

export function useInventarioSession() {
  const ctx = useContext(InventarioSessionContext);
  if (!ctx) {
    throw new Error("useInventarioSession must be used within InventarioSessionProvider");
  }
  return ctx;
}

export function useInventarioSessionOptional() {
  return useContext(InventarioSessionContext);
}
