/**
 * Android-specific hardware and UX enhancements
 * - Screen Wake Lock API (keeps Android screen awake while monitoring/filling)
 * - Android Haptic Vibration API (tactile feedback on buttons & alarms)
 * - Android PWA WebAPK Install Prompt Manager
 */

import { useState, useEffect, useCallback } from 'react';

// Screen Wake Lock controller
let wakeLockSentinel: any = null;

export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      if (wakeLockSentinel && !wakeLockSentinel.released) {
        return true;
      }
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request notice:', err);
      return false;
    }
  }
  return false;
}

export async function releaseScreenWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // ignore
    }
    wakeLockSentinel = null;
  }
}

// Android Haptic Vibration Feedback
export type HapticType = 'tap' | 'start' | 'stop' | 'success' | 'alarm' | 'emergency';

export function triggerHaptic(type: HapticType = 'tap'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'tap':
        navigator.vibrate(30);
        break;
      case 'start':
        navigator.vibrate([60, 40, 100]);
        break;
      case 'stop':
        navigator.vibrate([100, 50, 60]);
        break;
      case 'success':
        navigator.vibrate([70, 50, 70, 50, 120]);
        break;
      case 'alarm':
        navigator.vibrate([150, 100, 150, 100, 200]);
        break;
      case 'emergency':
        navigator.vibrate([300, 100, 300, 100, 500]);
        break;
      default:
        navigator.vibrate(30);
    }
  } catch {
    // ignore
  }
}

// Android PWA WebAPK / Home Screen Install Prompt Hook
export interface UseInstallPromptReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
  dismissInstall: () => void;
  isDismissed: boolean;
}

export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('hydrosense_install_dismissed') === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Install prompt error:', err);
      return false;
    }
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hydrosense_install_dismissed', 'true');
    }
  }, []);

  return {
    isInstallable: Boolean(deferredPrompt) && !isInstalled && !isDismissed,
    isInstalled,
    promptInstall,
    dismissInstall,
    isDismissed,
  };
}
