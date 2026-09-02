export type DeviceKind = 'ios' | 'android' | 'desktop' | 'unknown';

export function getDeviceKind(): DeviceKind {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isMobileDevice(): boolean {
  const kind = getDeviceKind();
  return kind === 'ios' || kind === 'android';
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getDeviceLabel(): string {
  const kind = getDeviceKind();
  if (kind === 'ios') return isStandalonePwa() ? 'iPhone (Home Screen app)' : 'iPhone (Safari)';
  if (kind === 'android') return 'Android phone';
  return 'This computer';
}

export interface NotificationSetupCopy {
  alertsTitle: string;
  alertsSubtitle: string;
  enableLabel: string;
  registeredMessage: string;
  needsRegistrationMessage: string;
  setupHint: string;
  setupSteps: string[] | null;
  deniedHelp: string;
  unsupportedMessage: string;
  testHint: string;
}

export function getNotificationSetupCopy(): NotificationSetupCopy {
  const kind = getDeviceKind();
  const standalone = isStandalonePwa();

  if (kind === 'ios') {
    if (!standalone) {
      return {
        alertsTitle: 'iPhone alerts',
        alertsSubtitle: 'Install Khawaja Club to your Home Screen, then enable alerts',
        enableLabel: 'Enable alerts on this iPhone',
        registeredMessage: 'This iPhone is registered for alerts.',
        needsRegistrationMessage:
          'Notifications are allowed, but this iPhone is not registered yet. Tap below to register.',
        setupHint:
          'On iPhone, web alerts work best from the Home Screen app — not from a Safari tab alone.',
        setupSteps: [
          'In Safari, tap Share (square with arrow)',
          'Tap Add to Home Screen',
          'Open Khawaja Club from the new icon',
          'Come back to Notifications and tap Enable alerts',
        ],
        deniedHelp:
          'Settings → Notifications → Khawaja Club → Allow Notifications. If you only use Safari, add the app to Home Screen first.',
        unsupportedMessage:
          'Push is not supported in this browser. On iPhone, use Safari, add Khawaja Club to Home Screen, then open it from the icon.',
        testHint: 'Close the app, lock your iPhone, and check Notification Center.',
      };
    }

    return {
      alertsTitle: 'iPhone alerts',
      alertsSubtitle: 'Get pop-ups when Khawaja Club is closed',
      enableLabel: 'Enable alerts on this iPhone',
      registeredMessage: 'This iPhone is registered for alerts.',
      needsRegistrationMessage:
        'Notifications are allowed, but this iPhone is not registered yet. Tap below to register.',
      setupHint: 'Tap below and choose Allow when iOS asks.',
      setupSteps: null,
      deniedHelp: 'Settings → Notifications → Khawaja Club → Allow Notifications',
      unsupportedMessage:
        'Push is not supported in this browser. Open Khawaja Club from your Home Screen icon.',
      testHint: 'Close the app, lock your iPhone, and check Notification Center.',
    };
  }

  if (kind === 'android') {
    return {
      alertsTitle: 'Phone alerts',
      alertsSubtitle: 'Get pop-ups on your lock screen even when Khawaja Club is closed',
      enableLabel: 'Enable phone alerts',
      registeredMessage: 'This phone is registered for lock-screen alerts.',
      needsRegistrationMessage:
        'Notifications are allowed, but this phone is not registered yet (common after an update). Tap below to register.',
      setupHint: 'Tap below and choose Allow when Chrome asks.',
      setupSteps: null,
      deniedHelp:
        'Android Settings → Apps → Chrome → Notifications → Allow. Also check site settings → Notifications → Allow for Khawaja Club.',
      unsupportedMessage:
        'Push is not supported in this browser. Use Chrome on Android, or add Khawaja Club to your Home Screen.',
      testHint:
        'Swipe Chrome away from recents, lock your phone, wait a few seconds, then pull down the notification shade.',
    };
  }

  return {
    alertsTitle: 'Desktop alerts',
    alertsSubtitle: 'Get browser pop-ups when Khawaja Club is in the background',
    enableLabel: 'Enable alerts on this computer',
    registeredMessage: 'This computer is registered for browser alerts.',
    needsRegistrationMessage:
      'Notifications are allowed, but this browser is not registered yet. Tap below to register.',
    setupHint:
      'Tap below and choose Allow. Desktop alerts usually need Chrome or Edge running in the background — they are not phone-style lock-screen alerts.',
    setupSteps: null,
    deniedHelp:
      'Click the lock icon in the address bar → Site settings → Notifications → Allow. Or check browser Settings → Privacy → Notifications.',
    unsupportedMessage:
      'Push is not supported in this browser. Use Chrome or Edge on this computer for desktop alerts.',
    testHint: 'Minimize the browser or switch tabs, then wait for the alert banner.',
  };
}

export function getPushDeniedMessage(): string {
  return getNotificationSetupCopy().deniedHelp;
}

export function getPushUnsupportedMessage(): string {
  return getNotificationSetupCopy().unsupportedMessage;
}
