import { Capacitor } from '@capacitor/core';

const _cache  = Object.create(null);
const _native = Capacitor.isNativePlatform();
let   _Prefs  = null;

export async function initStorage(keys) {
  if (_native) {
    const { Preferences } = await import('@capacitor/preferences');
    _Prefs = Preferences;
    await Promise.all(keys.map(async key => {
      const { value } = await _Prefs.get({ key });
      if (value !== null) {
        _cache[key] = value;
      } else {
        // One-time migration: v1 stored data in localStorage, v2 uses Preferences.
        // On first launch after update, copy any existing localStorage values across.
        try {
          const legacy = localStorage.getItem(key);
          if (legacy !== null) {
            _cache[key] = legacy;
            await _Prefs.set({ key, value: legacy });
            localStorage.removeItem(key);
          }
        } catch {}
      }
    }));
  } else {
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val !== null) _cache[key] = val;
    }
  }
}

export function getItem(key, def = null) {
  const v = _cache[key];
  return v !== undefined ? v : def;
}

export function setItem(key, value) {
  const str = value === null ? null : String(value);
  _cache[key] = str;
  if (_native && _Prefs) {
    str === null ? _Prefs.remove({ key }) : _Prefs.set({ key, value: str });
  } else {
    str === null ? localStorage.removeItem(key) : localStorage.setItem(key, str);
  }
}
