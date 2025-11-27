// --- Service Worker básico para PWA + Notificaciones ---

// Se ejecuta cuando el SW se instala
self.addEventListener("install", event => {
    console.log("Service Worker instalado");
    self.skipWaiting(); 
});

// Se ejecuta cuando el SW se activa
self.addEventListener("activate", event => {
    console.log("Service Worker activado");
    return self.clients.claim();
});

// Maneja notificaciones push (solo si tienes un servidor o Firebase)
self.addEventListener("push", event => {
    const data = event.data ? event.data.json() : {};

    const title = data.title || "Notificación";
    const body = data.body || "Tienes un nuevo mensaje.";
    const icon = data.icon || "/icon.png";

    event.waitUntil(
        self.registration.showNotification(title, {
            body: body,
            icon: icon
        })
    );
});