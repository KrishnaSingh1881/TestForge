import '@testing-library/jest-dom';

// jsdom does not implement window.matchMedia. Provide a minimal stub so that
// modules that read it at load time (e.g. AppWindow's reduceMotion constant)
// don't throw. Individual tests can override this stub via vi.stubGlobal or
// Object.defineProperty to control the `matches` return value.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
