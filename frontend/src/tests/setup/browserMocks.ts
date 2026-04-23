import { vi } from 'vitest';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class MockIntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
}

class MockSpeechRecognition {
  lang = 'en-US';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onend: (() => void) | null = null;

  start(): void {
    this.onstart?.();
  }

  stop(): void {
    this.onend?.();
  }
}

const localStorageMock = new MemoryStorage();
const sessionStorageMock = new MemoryStorage();

function createMockMediaStream(): MediaStream {
  const audioTrack = {
    kind: 'audio',
    enabled: true,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;

  const videoTrack = {
    kind: 'video',
    enabled: true,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;

  return {
    getTracks: () => [audioTrack, videoTrack],
    getAudioTracks: () => [audioTrack],
    getVideoTracks: () => [videoTrack],
  } as unknown as MediaStream;
}

export function setupBrowserMocks(): void {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  });

  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: sessionStorageMock,
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  });

  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });

  if (!('mediaDevices' in navigator)) {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {},
    });
  }

  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockResolvedValue(createMockMediaStream()),
  });

  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    writable: true,
    value: MockSpeechRecognition,
  });

  Object.defineProperty(window, 'webkitSpeechRecognition', {
    configurable: true,
    writable: true,
    value: MockSpeechRecognition,
  });

  if (!window.URL.createObjectURL) {
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock-url'),
    });
  }

  if (!window.URL.revokeObjectURL) {
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  }

  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
}

export function resetBrowserMocks(): void {
  localStorageMock.clear();
  sessionStorageMock.clear();
}
