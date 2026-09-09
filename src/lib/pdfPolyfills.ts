/**
 * Essential ECMAScript polyfills for PDF.js v6 compatibility across iPadOS, Safari, and tablets.
 * PDF.js v6 relies on cutting-edge TC39 proposals (Promise.try, Map.prototype.getOrInsertComputed,
 * Math.sumPrecise, Uint8Array.prototype.toHex, Uint8Array.prototype.toBase64, URL.parse).
 * These are not supported in Safari/iPadOS engines prior to 2025, causing PDF page rendering
 * to fail silently or crash with TypeErrors.
 */

// 1. Promise.try (Stage 4 TC39, missing in Safari < 18.2)
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function <T>(fn: (...args: any[]) => T | PromiseLike<T>, ...args: any[]): Promise<T> {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

// 2. Promise.withResolvers (Stage 4 TC39, missing in older Safari/WebKit)
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 3. Map.prototype.getOrInsertComputed & getOrInsert (TC39 Stage 3, missing in Safari)
if (typeof (Map.prototype as any).getOrInsertComputed !== 'function') {
  (Map.prototype as any).getOrInsertComputed = function <K, V>(key: K, callbackFn: (key: K) => V): V {
    if (this.has(key)) {
      return this.get(key) as V;
    }
    const value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}

if (typeof (Map.prototype as any).getOrInsert !== 'function') {
  (Map.prototype as any).getOrInsert = function <K, V>(key: K, defaultValue: V): V {
    if (this.has(key)) {
      return this.get(key) as V;
    }
    this.set(key, defaultValue);
    return defaultValue;
  };
}

// 4. WeakMap.prototype.getOrInsertComputed
if (typeof (WeakMap.prototype as any).getOrInsertComputed !== 'function') {
  (WeakMap.prototype as any).getOrInsertComputed = function <K extends object, V>(key: K, callbackFn: (key: K) => V): V {
    if (this.has(key)) {
      return this.get(key) as V;
    }
    const value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}

// 5. Math.sumPrecise (TC39 Stage 3, used in PDF.js layout & glyph sizing)
if (typeof (Math as any).sumPrecise !== 'function') {
  (Math as any).sumPrecise = function (iterable: Iterable<number>): number {
    let sum = 0;
    if (iterable) {
      for (const n of iterable) {
        sum += Number(n) || 0;
      }
    }
    return sum;
  };
}

// 6. Uint8Array.prototype.toHex (TC39 Stage 4, used in PDF.js document fingerprints)
if (typeof (Uint8Array.prototype as any).toHex !== 'function') {
  (Uint8Array.prototype as any).toHex = function (): string {
    let hex = '';
    const len = this.length;
    for (let i = 0; i < len; i++) {
      hex += this[i].toString(16).padStart(2, '0');
    }
    return hex;
  };
}

// 7. Uint8Array.prototype.toBase64 (TC39 Stage 4, used in PDF.js font creation createFontFaceRule)
if (typeof (Uint8Array.prototype as any).toBase64 !== 'function') {
  (Uint8Array.prototype as any).toBase64 = function (): string {
    let binary = '';
    const len = this.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(this[i]);
    }
    return typeof btoa === 'function' ? btoa(binary) : Buffer.from(this).toString('base64');
  };
}

// 8. URL.parse (TC39 Stage 4, used in PDF.js worker origin checking)
if (typeof (URL as any).parse !== 'function') {
  (URL as any).parse = function (url: string | URL, base?: string | URL): URL | null {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

// 9. Array.prototype.toReversed & toSorted
if (!(Array.prototype as any).toReversed) {
  (Array.prototype as any).toReversed = function () {
    return this.slice().reverse();
  };
}
if (!(Array.prototype as any).toSorted) {
  (Array.prototype as any).toSorted = function (compareFn?: (a: any, b: any) => number) {
    return this.slice().sort(compareFn);
  };
}

export const polyfillsApplied = true;
