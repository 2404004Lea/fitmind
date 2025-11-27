// Service Worker básico + soporte para notificaciones programadas

self.addEventListener("install", event => {
    console.log("SW instalado");
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    console.log("SW activado");
    return self.clients.claim();
});

// Notificaciones programadas para iPhone (iOS 16.4+)
self.addEventListener("notificationclick", event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow("/")
    );
});
