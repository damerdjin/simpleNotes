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
  saveHistory(studentId, assignmentId, snapshot) {
    if (remote.saveHistory) {
      remote.saveHistory(studentId, assignmentId, snapshot);
    }
  },
  async getLatestHistory(studentId, assignmentId) {
    if (remote.getLatestHistory) {
      return await remote.getLatestHistory(studentId, assignmentId);
    }
    return null;
  },
  async deleteHistory(historyId) {
    if (remote.deleteHistory) {
      await remote.deleteHistory(historyId);
    }
  },
  async getSharedClasses(onlyMine = false) {
    if (remote.getSharedClasses) {
      return await remote.getSharedClasses(onlyMine);
    }
    return [];
  },
  async getSharedClassStats() {
    if (remote.getSharedClassStats) {
      return await remote.getSharedClassStats();
    }
    return {};
  },
  async unsubscribeFromClass(className) {
    if (remote.unsubscribeFromClass) {
      await remote.unsubscribeFromClass(className);
    }
  },
  async subscribeToClass(className) {
    if (remote.subscribeToClass) {
      await remote.subscribeToClass(className);
    }
  },
  async getSharedStudents(className) {
    if (remote.getSharedStudents) {
      return await remote.getSharedStudents(className);
    }
    return [];
  },
  get(key) {
    return local.get(key);
  },
  set(key, value) {
    local.set(key, value);
  }
};
