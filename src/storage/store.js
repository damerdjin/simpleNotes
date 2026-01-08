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
  load() {
    const localData = local.load();
    Promise.resolve()
      .then(() => remote.load())
      .then((remoteData) => {
        if (!remoteData) return;
        if (!shallowEqual(remoteData, localData)) {
          try {
            local.save(remoteData);
            if (typeof window !== 'undefined') {
              window.data = remoteData;
              if (window.renderStudents) window.renderStudents();
              if (window.renderAssignments) window.renderAssignments();
              if (window.loadExportPrepConfig) window.loadExportPrepConfig();
              if (window.loadClassSelectorsForExport) window.loadClassSelectorsForExport();
              if (window.softResetUI) window.softResetUI();
            }
          } catch (_) {}
        }
      })
      .catch(() => {});
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
