"use client";

import { useEffect } from "react";

export default function ServiceWorkerManager() {

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const isProduction = process.env.NODE_ENV === "production";

    const canUseServiceWorker =
      "serviceWorker" in navigator && (isLocalhost || isProduction);

    // ----------------------------
    // Register Service Worker
    // ----------------------------
    const registerServiceWorker = async () => {
      if (!canUseServiceWorker) {
        console.warn("Service Worker skipped (invalid SSL or dev environment)");
        return;
      }

      try {
        await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker registered successfully");
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    };

    // ----------------------------
    // Try Push Subscription
    // ----------------------------
    const attemptSubscription = async () => {
      if (!canUseServiceWorker) return;
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      try {
        const registration = await navigator.serviceWorker.getRegistration();

        if (!registration) {
          console.warn("No Service Worker registration found");
          return;
        }

        await subscribeToPush(registration);

      } catch (error) {
        console.error("Push subscription attempt failed:", error);
      }
    };

    // ----------------------------
    // Permission Change Listener
    // ----------------------------
    const setupPermissionListener = async () => {
      if (!("permissions" in navigator)) return;

      try {
        const status = await navigator.permissions.query({
          name: "notifications",
        } as PermissionDescriptor);

        status.onchange = () => {
          if (status.state === "granted") {
            console.log("Notification permission granted via browser settings");
            attemptSubscription();
          }
        };
      } catch {
        // Not supported everywhere
      }
    };

    // ----------------------------
    // Initialize
    // ----------------------------
    registerServiceWorker();
    attemptSubscription();
    setupPermissionListener();

  }, []);

  // ----------------------------
  // Push Subscribe Function
  // ----------------------------
  const subscribeToPush = async (
    registration: ServiceWorkerRegistration
  ) => {
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        console.warn("VAPID public key missing");
        return;
      }

      const convertedKey = urlBase64ToUint8Array(publicKey);
      if (!convertedKey) return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      console.log("Push Subscription Success");
      console.log(JSON.stringify(subscription));

    } catch (error) {
      console.error("Push subscription failed:", error);
    }
  };

  // ----------------------------
  // Base64 Key Converter
  // ----------------------------
  const urlBase64ToUint8Array = (base64String: string) => {
    try {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

      const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const rawData = window.atob(base64);
      return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));

    } catch (error) {
      console.error("VAPID key conversion error:", error);
      return null;
    }
  };

  return null;
}
