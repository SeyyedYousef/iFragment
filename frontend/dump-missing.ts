import { dict as en } from './src/shared/i18n/en.js';
import { dict as fa } from './src/shared/i18n/fa.js';
import { dict as ru } from './src/shared/i18n/ru.js';
import { dict as zh } from './src/shared/i18n/zh.js';
import fs from 'fs';

function getMissingKeysObj(base: any, target: any) {
  let missing: any = {};
  for (const key in base) {
    if (typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])) {
      if (!target[key]) {
        missing[key] = base[key];
      } else {
        const sub = getMissingKeysObj(base[key], target[key]);
        if (Object.keys(sub).length > 0) {
          missing[key] = sub;
        }
      }
    } else {
      if (target[key] === undefined) {
        missing[key] = base[key];
      }
    }
  }
  return missing;
}

const faMissing = getMissingKeysObj(en, fa);
fs.writeFileSync('missing-fa.json', JSON.stringify(faMissing, null, 2));

const ruMissing = getMissingKeysObj(en, ru);
fs.writeFileSync('missing-ru.json', JSON.stringify(ruMissing, null, 2));

const zhMissing = getMissingKeysObj(en, zh);
fs.writeFileSync('missing-zh.json', JSON.stringify(zhMissing, null, 2));

console.log('Saved missing keys to JSON files.');
