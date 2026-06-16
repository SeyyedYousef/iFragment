import fs from 'fs';
import path from 'path';

function parseDict(content) {
	// Very hacky but fast way to evaluate the object
	// remove "export const dict = " and any trailing ";"
	let js = content.replace(/export\s+const\s+dict\s*=\s*/, '');
	// sometimes it might have type annotations like `export const dict: Dictionary = {`
	js = js.replace(/export\s+const\s+[a-zA-Z0-9_]+\s*(:\s*[a-zA-Z0-9_]+)?\s*=\s*/, '');

	// if it ends with }; remove the ;
	js = js.trim();
	if (js.endsWith(';')) js = js.slice(0, -1);

	// we can use Function to evaluate it safely
	try {
		const fn = new Function('return ' + js);
		return fn();
	} catch (e) {
		// maybe there are imports?
		console.error('Error parsing', e);
		return null;
	}
}

const dir = 'c:\\Users\\DEll\\Desktop\\iFragment\\frontend\\src\\shared\\i18n';
const enContent = fs.readFileSync(path.join(dir, 'en.ts'), 'utf8');
const faContent = fs.readFileSync(path.join(dir, 'fa.ts'), 'utf8');
const ruContent = fs.readFileSync(path.join(dir, 'ru.ts'), 'utf8');
const zhContent = fs.readFileSync(path.join(dir, 'zh.ts'), 'utf8');

const en = parseDict(enContent);
const fa = parseDict(faContent);
const ru = parseDict(ruContent);
const zh = parseDict(zhContent);

if (!en) {
	console.log('Failed to parse EN. Using Regex fallback...');
}

// Better fallback: we know it's TS, maybe we can just run tsx if we use a runner.
