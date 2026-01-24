import { useState, useEffect } from 'react';

// Interface for the BeforeInstallPromptEvent (experimental)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Detect if already installed (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstallable(false);
      return; // Stop here if already installed
    }

    // Android/Desktop: Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS: If not standalone, we can consider it "installable" via manual instructions
    if (isIosDevice && !isStandalone) {
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (isIOS) {
      return 'iOS'; // Signal caller to show iOS instructions
    }

    if (!deferredPrompt) {
      return null;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // Reset after choice
    setDeferredPrompt(null);
    setIsInstallable(false); // Hide button after interaction

    return outcome;
  };

  return { isInstallable, promptInstall };
}
