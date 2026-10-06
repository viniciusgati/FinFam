"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA é uma melhoria progressiva; falha no registro não deve quebrar a UI.
      });
    }
  }, []);

  return null;
}
