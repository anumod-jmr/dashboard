# Notification System Implementation Guide

## Overview
This document outlines the final implementation of the notification system for the JMR Unified Dashboard. It uses a **Service Worker** and **VAPID Keys** to support robust Web Push Notifications.

## Core Features

### 1. Zero-Click Setup
*   **Automatic Detection**: The dashboard automatically detects if the user has granted notification permissions via the browser's native settings (Lock/Eye icon).
*   **Instant Subscription**: As soon as permission is detected as `granted`, the system silently subscribes the user to the push service in the background. Does not require a manual "Subscribe" button.

### 2. Robust Alerting (Two Modes)
*   **Active Dashboard**:
    *   **Visual**: The Bell Icon shakes and displays a red badge count.
    *   **Audio**: A "Ding-Dong" chime plays.
*   **Background / Minimized**:
    *   **System Toast**: A native Windows notification appears via the Browser's Service Worker.
    *   **Persistent**: The notification stays on screen (`requireInteraction: true`) until missed.
    *   **Urgent**: It triggers sound/vibrate (`renotify: true`) for every new event.

## Technical Architecture

### **1. Key Management (VAPID)**
*   **Public Key**: Stored in `.env.local`. Shared with the browser to identify the application.
*   **Private Key**: Stored securely on the backend (not visible to users). Used to cryptographically "sign" alerts so browsers know they are legitimate.
*   **Keys Generation**: Keys are generated once and do not rotate unless manually reset.

### **2. Service Worker (`public/sw.js`)**
*   **Purpose**: A script that runs in the background, independent of the web page.
*   **Push Event**: Listens for the `push` signal from the message server (e.g., Firebase/Mozilla) and displays the notification.
*   **Click Event**: Handles `notificationclick` to waken the tab or open a new window when the user clicks the alert.

### **3. Frontend Logic (`ServiceWorkerManager.tsx`)**
*   **Permission Monitoring**: Uses the Permission API to listen for changes.
    *   *Scenario*: User changes setting from "Block" -> "Allow".
    *   *Action*: Component detects change -> Registration -> Subscription -> Success.
*   **Subscription**: Generates a unique endpoint for that specific browser instance and logs it (Future: Sends to backend).

## Usage Guide

### **Enabling Alerts**
1.  **Click the Lock Icon (🔒)** in the browser address bar.
2.  Find **Notifications** and select **Allow**.
3.  **Done**. The system will automatically detect this change and register you for alerts.

### **Browser State**
*   **Active Tab**: ✅ Alerts via Bell Icon & Toast.
*   **Minimized / Hidden**: ✅ Alerts via System Toast.
*   **Closed Tab**: ⚠️ Requires Backend Push Integration.
    *   *Current State*: Polling stops if tab is closed.
    *   *Future State*: With full backend integration (sending Push messages to the saved Subscription endpoint), alerts **WILL** work even if the tab is completely closed.

## Critical Setup
*   **Environment**: `.env.local` must contain a valid `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
*   **Assets**: Ensure `public/jmr-logo.png` exists for the notification icon.
*   **OS Settings**: Windows **Focus Assist / Do Not Disturb** must be OFF.

---
*Last Updated: 2026-01-19*
