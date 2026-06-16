import { dict as en } from './src/shared/i18n/en.js';
import { dict as fa } from './src/shared/i18n/fa.js';
import { dict as ru } from './src/shared/i18n/ru.js';
import { dict as zh } from './src/shared/i18n/zh.js';

function flattenKeys(obj: any, prefix = ''): Set<string> {
	let keys = new Set<string>();
	for (const key in obj) {
		if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
			const subKeys = flattenKeys(obj[key], prefix + key + '.');
			for (const subKey of subKeys) {
				keys.add(subKey);
			}
		} else {
			keys.add(prefix + key);
		}
	}
	return keys;
}

const enKeys = flattenKeys(en);
const faKeys = flattenKeys(fa);
const ruKeys = flattenKeys(ru);
const zhKeys = flattenKeys(zh);

console.log(`Total EN keys: ${enKeys.size}`);

function checkMissing(name: string, keys: Set<string>) {
	let missing = [];
	for (const key of enKeys) {
		if (!keys.has(key)) {
			missing.push(key);
		}
	}
	console.log(`\n${name} missing ${missing.length} keys:`);

	// Group missing keys by section
	const grouped = missing.reduce(
		(acc, key) => {
			const section = key.split('.')[0];
			if (!acc[section]) acc[section] = [];
			acc[section].push(key);
			return acc;
		},
		{} as Record<string, string[]>,
	);

	for (const section in grouped) {
		console.log(`- ${section}: ${grouped[section].length} missing keys`);
	}
}

checkMissing('FA', faKeys);
checkMissing('RU', ruKeys);
checkMissing('ZH', zhKeys);
