// Service worker de push do Nuvi. A notificação é só texto genérico (título, texto, tag):
// nunca dado de saúde. O servidor envia { title, body, tag, url }.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  const title = typeof d.title === "string" && d.title ? d.title : "Nuvi";
  const url = typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/hoje";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof d.body === "string" ? d.body : "",
      tag: typeof d.tag === "string" ? d.tag : "nuvi",
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const alvo = new URL((event.notification.data && event.notification.data.url) || "/hoje", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if (aba.url.startsWith(self.location.origin) && "focus" in aba) {
          return aba.navigate(alvo).then((c) => (c || aba).focus()).catch(() => aba.focus());
        }
      }
      return self.clients.openWindow(alvo);
    }),
  );
});
