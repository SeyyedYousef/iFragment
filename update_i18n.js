const fs = require('fs');
const path = require('path');

const files = {
  'en.ts': "leaveClan: 'Leave squad',\n\t\t\tday: 'Day',\n\t\t\tweek: 'Week',\n\t\t\tyou: 'You'",
  'fa.ts': "leaveClan: 'ترک تیم',\n\t\t\tday: 'روز',\n\t\t\tweek: 'هفته',\n\t\t\tyou: 'شما'",
  'ru.ts': "leaveClan: 'Покинуть отряд',\n\t\t\tday: 'День',\n\t\t\tweek: 'Неделя',\n\t\t\tyou: 'Вы'",
  'zh.ts': "leaveClan: '离开小队',\n\t\t\tday: '天',\n\t\t\tweek: '周',\n\t\t\tyou: '你'"
};

const dir = path.join(__dirname, 'frontend', 'src', 'shared', 'i18n');

for (const [file, repl] of Object.entries(files)) {
  const fp = path.join(dir, file);
  if (!fs.existsSync(fp)) continue;
  let content = fs.readFileSync(fp, 'utf8');
  
  if (!content.includes("you: '")) {
    const regex = new RegExp(`leaveClan:\\s*['"][^'"]+['"]`, 'g');
    // Replace only the LAST occurrence which is in airdropFinal.clan
    const matches = [...content.matchAll(regex)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      content = content.substring(0, lastMatch.index) + repl + content.substring(lastMatch.index + lastMatch[0].length);
      fs.writeFileSync(fp, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  } else {
    console.log(`Already updated ${file}`);
  }
}
