"use client";

import { useEffect } from "react";

export default function ServiceWorkerManager() {

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Register Service Worker on mount
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.error("SW Register Error:", err));
    }

    // 2. Logic to attempt subscription if permission is granted
    const attemptSubscription = async () => {
      if (!("serviceWorker" in navigator)) return;

      // Only subscribe if permission is explicitly granted
      if (Notification.permission !== 'granted') return;

      try {
        const registration = await navigator.serviceWorker.ready;
        await subscribeToPush(registration);
      } catch (error) {
        console.error("Subscription attempt failed:", error);
      }
    };

    // 3. Initial check on load
    attemptSubscription();

    // 4. Listen for permission changes (e.g. user clicking the 'eye' / lock icon)
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then((status) => {
        status.onchange = () => {
          // Automatically subscribe if the user changes setting to 'granted'
          if (status.state === 'granted') {
            console.log("Permission granted via browser settings. Subscribing...");
            attemptSubscription();
          }
        };
      }).catch(() => {
        // Permissions API might not support 'notifications' on all browsers
      });
    }
  }, []);

  const subscribeToPush = async (registration: ServiceWorkerRegistration) => {
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.warn("VAPID Public Key not found in environment variables");
        return;
      }

      const convertedKey = urlBase64ToUint8Array(publicKey);
      if (!convertedKey) return; // Stop if key conversion failed

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      console.log("Push Subscription Successful:", JSON.stringify(subscription));
      // TODO: Send 'subscription' to your backend API to save it

    } catch (error) {
      // Don't alert the user, just log
      console.error("Subscription failed:", error);
    }
  };

  function urlBase64ToUint8Array(base64String: string) {
    // Validation: Check for obviously malformed keys (like copied truncated keys)
    if (base64String.includes('...') || base64String.length < 20) {
      console.error("VAPID Public Key appears to be invalid or truncated (contains '...'). Please check your .env.local file.");
      return null;
    }

    try {
      const trimmedBase64String = base64String.trim();
      const padding = '='.repeat((4 - trimmedBase64String.length % 4) % 4);
      const base64 = (trimmedBase64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (e) {
      console.error("Failed to convert VAPID key. It may be malformed or truncated.", e);
      return null;
    }
  }

  // No visible UI anymore
  return null;
}
