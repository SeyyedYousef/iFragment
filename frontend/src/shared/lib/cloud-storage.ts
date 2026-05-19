/**
 * Telegram WebApp CloudStorage API Helper
 * Promise-based wrappers for Telegram's native CloudStorage.
 */

const getCloudStorage = () => (window as any).Telegram?.WebApp?.CloudStorage;

export const cloudStorage = {
  setItem: (key: string, value: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const cs = getCloudStorage();
        if (!cs) {
          localStorage.setItem(key, value);
          resolve(true);
          return;
        }
        cs.setItem(key, value, (error: any, success: boolean) => {
          resolve(!error && success);
        });
      } catch {
        localStorage.setItem(key, value);
        resolve(true);
      }
    });
  },

  getItem: (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const cs = getCloudStorage();
        if (!cs) {
          resolve(localStorage.getItem(key));
          return;
        }
        cs.getItem(key, (error: any, value: string) => {
          if (error) resolve(null);
          else resolve(value || null);
        });
      } catch {
        resolve(localStorage.getItem(key));
      }
    });
  },

  getItems: (keys: string[]): Promise<Record<string, string>> => {
    return new Promise((resolve) => {
      try {
        const cs = getCloudStorage();
        if (!cs) {
          const res: Record<string, string> = {};
          keys.forEach(k => {
            const v = localStorage.getItem(k);
            if (v !== null) res[k] = v;
          });
          resolve(res);
          return;
        }
        cs.getItems(keys, (error: any, values: Record<string, string>) => {
          if (error) resolve({});
          else resolve(values || {});
        });
      } catch {
        const res: Record<string, string> = {};
        keys.forEach(k => {
          const v = localStorage.getItem(k);
          if (v !== null) res[k] = v;
        });
        resolve(res);
      }
    });
  },

  removeItem: (key: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const cs = getCloudStorage();
        if (!cs) {
          localStorage.removeItem(key);
          resolve(true);
          return;
        }
        cs.removeItem(key, (error: any, success: boolean) => {
          resolve(!error && success);
        });
      } catch {
        localStorage.removeItem(key);
        resolve(true);
      }
    });
  },

  removeItems: (keys: string[]): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const cs = getCloudStorage();
        if (!cs) {
          keys.forEach(k => localStorage.removeItem(k));
          resolve(true);
          return;
        }
        cs.removeItems(keys, (error: any, success: boolean) => {
          resolve(!error && success);
        });
      } catch {
        keys.forEach(k => localStorage.removeItem(k));
        resolve(true);
      }
    });
  },

  getKeys: (): Promise<string[]> => {
    return new Promise((resolve) => {
      try {
        const cs = getCloudStorage();
        if (!cs) {
          resolve(Object.keys(localStorage));
          return;
        }
        cs.getKeys((error: any, keys: string[]) => {
          if (error) resolve([]);
          else resolve(keys || []);
        });
      } catch {
        resolve(Object.keys(localStorage));
      }
    });
  }
};
