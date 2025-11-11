export {}

declare global {
    interface Window {
      gtag?: (command: 'config' | 'event' | 'set' | 'consent', targetId?: string, params?: Record<string, unknown>) => void;
    }
  }