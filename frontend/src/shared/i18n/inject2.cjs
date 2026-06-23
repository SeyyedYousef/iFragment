const fs = require('fs');
const files = ['en.ts', 'fa.ts', 'ru.ts', 'zh.ts'];
const additions = {
  en: `
		boosters: {
			freeDaily: 'Free daily boosters',
			turbo: 'Turbo',
			fullEnergy: 'Full Energy',
			available: '{count} available',
			boostersTitle: 'Boosters',
			maxLevelReached: 'Maximum level reached',
			lvl: 'lvl',
			meta: {
				tapPower: { name: 'Multitap', desc: 'Increase coin earn per tap' },
				energyCap: { name: 'Energy Limit', desc: 'Increase maximum energy capacity' },
				tapBot: { name: 'Auto-Tap Bot', desc: 'Mines coins while you are away' }
			}
		},`,
  fa: `
		boosters: {
			freeDaily: 'بوسترهای رایگان روزانه',
			turbo: 'توربو',
			fullEnergy: 'انرژی کامل',
			available: '{count} موجود',
			boostersTitle: 'بوسترها',
			maxLevelReached: 'به حداکثر سطح رسید',
			lvl: 'سطح',
			meta: {
				tapPower: { name: 'چند-تپ', desc: 'افزایش سکه در هر تپ' },
				energyCap: { name: 'محدودیت انرژی', desc: 'افزایش ظرفیت مخزن انرژی' },
				tapBot: { name: 'ربات استخراج', desc: 'استخراج سکه وقتی آنلاین نیستید' }
			}
		},`,
  ru: `
		boosters: {
			freeDaily: 'Бесплатные ежедневные бустеры',
			turbo: 'Турбо',
			fullEnergy: 'Полная энергия',
			available: '{count} доступно',
			boostersTitle: 'Бустеры',
			maxLevelReached: 'Достигнут максимальный уровень',
			lvl: 'ур.',
			meta: {
				tapPower: { name: 'Мульти-тап', desc: 'Увеличивает добычу за нажатие' },
				energyCap: { name: 'Лимит энергии', desc: 'Увеличивает максимальную энергию' },
				tapBot: { name: 'Авто-бот', desc: 'Добывает монеты, пока вас нет' }
			}
		},`,
  zh: `
		boosters: {
			freeDaily: '每日免费助推器',
			turbo: '涡轮',
			fullEnergy: '满能量',
			available: '可用 {count}',
			boostersTitle: '助推器',
			maxLevelReached: '已达到最高等级',
			lvl: '级',
			meta: {
				tapPower: { name: '多重点击', desc: '增加每次点击赚取的硬币' },
				energyCap: { name: '能量上限', desc: '增加最大能量容量' },
				tapBot: { name: '自动点击机器人', desc: '在您离开时挖矿' }
			}
		},`
};

files.forEach(f => {
  const p = 'c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/' + f;
  let code = fs.readFileSync(p, 'utf8');
  const idx = code.indexOf('airdropFinal: {');
  if (idx > -1) {
    const insertIdx = code.indexOf('{', idx) + 1;
    const lang = f.split('.')[0];
    const newCode = code.substring(0, insertIdx) + additions[lang] + code.substring(insertIdx);
    fs.writeFileSync(p, newCode);
    console.log('Appended boosters to ' + f);
  }
});
