import { localStorageAdapter } from './localStorage.adapter.js';
import { supabaseAdapter } from './supabase.adapter.js';

function shallowEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return false;
  }
}

const local = localStorageAdapter();
const remote = supabaseAdapter();

export const store = {
  async load() {
    const localData = local.load();
    try {
      // Priorité au chargement distant pour éviter d'écraser des données plus récentes
      const remoteData = await remote.load();
      if (remoteData) {
        if (!shallowEqual(remoteData, localData)) {
          console.log('[Store] Remote data differs from local, updating local storage');
          local.save(remoteData);
        }
        return remoteData;
      }
    } catch (err) {
      console.warn('[Store] Remote load failed or timed out, falling back to local data', err);
    }
    return localData;
  },
  save(payload) {
    local.save(payload);
    Promise.resolve()
      .then(() => remote.save(payload))
      .catch(() => {});
  },
  get(key) {
    return local.get(key);
  },
  set(key, value) {
    local.set(key, value);
  }
};
