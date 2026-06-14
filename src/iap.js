import { Capacitor } from '@capacitor/core';
import { getItem, setItem } from './storage.js';

const STORAGE_COINS = 'plunge_coins';

export const COIN_PACKAGES = [
  { id: 'plunge_coins_099', label: '$0.99', coins: 100  },
  { id: 'plunge_coins_199', label: '$1.99', coins: 200  },
  { id: 'plunge_coins_499', label: '$4.99', coins: 500  },
  { id: 'plunge_coins_999', label: '$9.99', coins: 1000 },
];

const _listeners = new Set();
let _store = null;
let _CdvPurchase = null;

export function onCoinsGranted(cb)  { _listeners.add(cb); }
export function offCoinsGranted(cb) { _listeners.delete(cb); }
export function isIAPReady()        { return Capacitor.isNativePlatform() && _store !== null; }

function _grant(coins) {
  const cur     = parseInt(getItem(STORAGE_COINS, '0'), 10);
  const updated = cur + coins;
  setItem(STORAGE_COINS, String(updated));
  _listeners.forEach(cb => cb(coins, updated));
}

export async function initIAP() {
  if (!Capacitor.isNativePlatform()) return;
  const mod = await import('capacitor-plugin-cdv-purchase');
  _CdvPurchase = mod.CdvPurchase;
  const { store, ProductType, Platform } = _CdvPurchase;
  _store = store;

  store.register(COIN_PACKAGES.map(p => ({
    id: p.id,
    type: ProductType.CONSUMABLE,
    platform: Platform.GOOGLE_PLAY,
  })));

  store.when()
    .approved(t => t.verify())
    .verified(receipt => {
      const productId = receipt.transactions?.[0]?.products?.[0]?.id;
      const pkg = COIN_PACKAGES.find(p => p.id === productId);
      if (pkg) _grant(pkg.coins);
      receipt.finish();
    });

  await store.initialize([Platform.GOOGLE_PLAY]);
}

export async function purchaseCoins(productId) {
  if (!_store || !_CdvPurchase) return;
  const product = _store.get(productId, _CdvPurchase.Platform.GOOGLE_PLAY);
  if (product?.canPurchase) await _store.order(product);
}
