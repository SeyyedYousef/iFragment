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
					try {
						localStorage.setItem(key, value);
					} catch {}
					resolve(true);
					return;
				}
				cs.setItem(key, value, (error: any, success: boolean) => {
					resolve(!error && success);
				});
			} catch {
				try {
					localStorage.setItem(key, value);
					resolve(true);
				} catch {
					resolve(false);
				}
			}
		});
	},

	getItem: (key: string): Promise<string | null> => {
		return new Promise((resolve) => {
			try {
				const cs = getCloudStorage();
				if (!cs) {
					try {
						resolve(localStorage.getItem(key));
					} catch {
						resolve(null);
					}
					return;
				}
				cs.getItem(key, (error: any, value: string) => {
					if (error) resolve(null);
					else resolve(value || null);
				});
			} catch {
				try {
					resolve(localStorage.getItem(key));
				} catch {
					resolve(null);
				}
			}
		});
	},

	getItems: (keys: string[]): Promise<Record<string, string>> => {
		return new Promise((resolve) => {
			try {
				const cs = getCloudStorage();
				if (!cs) {
					const res: Record<string, string> = Object.create(null);
					keys.forEach((k) => {
						try {
							const v = localStorage.getItem(k);
							if (v !== null) res[k] = v;
						} catch {}
					});
					resolve(res);
					return;
				}
				cs.getItems(keys, (error: any, values: Record<string, string>) => {
					if (error) resolve({});
					else {
						const safeValues = Object.create(null);
						if (values)
							Object.keys(values).forEach((k) => {
								safeValues[k] = values[k];
							});
						resolve(safeValues);
					}
				});
			} catch {
				const res: Record<string, string> = Object.create(null);
				keys.forEach((k) => {
					try {
						const v = localStorage.getItem(k);
						if (v !== null) res[k] = v;
					} catch {}
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
					try {
						localStorage.removeItem(key);
					} catch {}
					resolve(true);
					return;
				}
				cs.removeItem(key, (error: any, success: boolean) => {
					resolve(!error && success);
				});
			} catch {
				try {
					localStorage.removeItem(key);
					resolve(true);
				} catch {
					resolve(false);
				}
			}
		});
	},

	removeItems: (keys: string[]): Promise<boolean> => {
		return new Promise((resolve) => {
			try {
				const cs = getCloudStorage();
				if (!cs) {
					keys.forEach((k) => {
						try {
							localStorage.removeItem(k);
						} catch {}
					});
					resolve(true);
					return;
				}
				cs.removeItems(keys, (error: any, success: boolean) => {
					resolve(!error && success);
				});
			} catch {
				keys.forEach((k) => {
					try {
						localStorage.removeItem(k);
					} catch {}
				});
				resolve(true);
			}
		});
	},

	getKeys: (): Promise<string[]> => {
		return new Promise((resolve) => {
			try {
				const cs = getCloudStorage();
				if (!cs) {
					try {
						resolve(Object.keys(localStorage));
					} catch {
						resolve([]);
					}
					return;
				}
				cs.getKeys((error: any, keys: string[]) => {
					if (error) resolve([]);
					else resolve(keys || []);
				});
			} catch {
				try {
					resolve(Object.keys(localStorage));
				} catch {
					resolve([]);
				}
			}
		});
	},
};
