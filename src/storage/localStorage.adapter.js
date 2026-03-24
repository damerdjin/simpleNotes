export function localStorageAdapter() {
  return {
    load() {
      try {
        const s = localStorage.getItem('corrections-data');
        if (s) return JSON.parse(s);
      } catch (_) {}
      return { students: [], assignments: [], grades: {} };
    },
    save(data) {
      localStorage.setItem('corrections-data', JSON.stringify(data));
    },
    get(key) {
      return localStorage.getItem(key);
    },
    set(key, value) {
      localStorage.setItem(key, value);
    }
  };
}
