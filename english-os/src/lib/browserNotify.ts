/** Small popup while the app is open (not lock-screen push). */
export function showBrowserNotification(title: string, body: string, tag?: string): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, tag: tag ?? 'khawaja-club', icon: '/icon-192.png' });
    return;
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        new Notification(title, { body, tag: tag ?? 'khawaja-club', icon: '/icon-192.png' });
      }
    });
  }
}

export function requestNotificationPermission(): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}
