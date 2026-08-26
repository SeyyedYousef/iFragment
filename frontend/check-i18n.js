// check-i18n.js — i18n integrity gate
// 1) Parity: every locale dict must expose exactly the same key set as en.ts
// 2) Hardcode: no user-facing literal strings outside src/shared/i18n
//
// Run: node check-i18n.js        (exit 1 on any violation)
//      node check-i18n.js --report   (full list of violations)

import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPORT = process.argv.includes('--report');

const I18N_DIR = path.join(__dirname, 'src', 'shared', 'i18n');
const SRC_DIR = path.join(__dirname, 'src');
const SKIP_DIRS = new Set(['shared/i18n', 'node_modules']);
const LOCALES = ['en', 'fa', 'ru', 'zh'];

// ─────────────────────────── dict parsing ───────────────────────────

function evalDict(file) {
	const raw = fs.readFileSync(file, 'utf8').trim();
	const js = raw.replace(/export\s+const\s+\w+\s*(:\s*\w+)?\s*=\s*/, '').replace(/;\s*$/, '');
	return new Function(`"use strict"; return (${js});`)();
}

function flatten(obj, prefix = '', out = {}) {
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === 'object') flatten(v, key, out);
		else out[key] = String(v);
	}
	return out;
}

const dicts = {};
let parseError = false;
for (const loc of LOCALES) {
	try {
		dicts[loc] = flatten(evalDict(path.join(I18N_DIR, `${loc}.ts`)));
	} catch (e) {
		console.error(`❌ Failed to evaluate ${loc}.ts: ${e.message}`);
		parseError = true;
	}
}
if (parseError || !dicts.en) process.exit(1);

const errors = [];
const warnings = [];

// ─────────────────────────── 1. parity ───────────────────────────

const enKeys = Object.keys(dicts.en).sort();
for (const loc of LOCALES.slice(1)) {
	const keys = Object.keys(dicts[loc]).sort();
	const missing = enKeys.filter((k) => !keys.includes(k));
	const extra = keys.filter((k) => !enKeys.includes(k));
	if (missing.length) errors.push(`[${loc}] missing ${missing.length} keys: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' …' : ''}`);
	if (extra.length) errors.push(`[${loc}] ${extra.length} unknown keys: ${extra.slice(0, 12).join(', ')}${extra.length > 12 ? ' …' : ''}`);
	// empty translations
	const empty = keys.filter((k) => !keys.includes(k) === false && dicts[loc][k].trim() === '');
	if (empty.length) errors.push(`[${loc}] ${empty.length} empty values`);
}

// ─────────────────────────── 2. hardcode scan ───────────────────────────

// Persian/Arabic script block (incl. extended/presentation forms)
const AR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
// JSX text nodes: > text <  (no braces/tags/newlines inside)
const JSX_TEXT = />\s*([^<>{}\n]*[A-Za-z\u0600-\u06FF][^<>{}\n]*)\s*</g;
// literal string attributes that face users
const ATTR = /\b(placeholder|title|aria-label|alt|label)\s*=\s*"([^"]+)"/g;
// toast/notification/alert literals
const TOAST = /\b(toast|showToast|notify)\.\w+\(\s*([`'"])(.{2,200}?)\2/g;
// template-literal toasts with interpolation
const TPL_TOAST = /\b(toast|showToast|notify)\.\w+\(\s*`(.*?)(?<!\\)`/gs;

const CODE_TOKENS = [
	'apiClient.', 'apiFetch(', 'validatedFetch(', 'Promise', '=>', 'await ',
	'return ', 'import ', 'from ', 'function', 'const ', 'let ', 'class=',
	'http://', 'https://', '/', '${',
];

/** Material Symbols ligature names (icon glyphs rendered as words) */
const ICON_FILE_HINT = /material-symbols|MaterialIcon|icon/i;

function isIconGlyph(text, before) {
	if (!ICON_FILE_HINT.test(before)) return false;
	// single word or two-word snake glyph like "arrow_forward", "cloud_upload"
	return /^[\w-]{1,32}$/.test(text.trim()) && !/[.!?]/.test(text);
}

function looksLikeCode(t) {
	if (CODE_TOKENS.some((tok) => t.includes(tok))) return true;
	if (/^[\s\p{S}\p{P}0-9]+$/u.test(t)) return true; // symbols/digits only
	// comparison/logic expressions masquerading as JSX text (e.g. "a >= 1 && b <= 6")
	if (/[()]|[=;|]|&&|\|\||>=|<=/.test(t)) return true;
	return false;
}

function scanFile(absPath, rel) {
	const isTsx = absPath.endsWith('.tsx');
	let src;
	try {
		src = fs.readFileSync(absPath, 'utf8');
	} catch {
		return;
	}
	const lines = src.split('\n');

	const push = (lineNo, kind, text) => errors.push(`${rel}:${lineNo} [${kind}] ${text.slice(0, 140)}`);

	// a) Persian/RTL characters anywhere (comments excluded)
	lines.forEach((raw, i) => {
		let s = raw.trim();
		// strip trailing // comment (not inside a string literal — heuristic: last ' //')
		const cIdx = s.indexOf('//');
		if (cIdx > 0 && !s.slice(0, cIdx).includes("'") && !s.slice(0, cIdx).includes('"') && !s.slice(0, cIdx).includes('`')) {
			s = s.slice(0, cIdx).trim();
			if (!s) return;
		}
		if (AR.test(s) && !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*')) {
			push(i + 1, 'hardcoded-fa', s);
		}
	});

	if (!isTsx && !absPath.endsWith('.ts')) return;
	if (/\.test\.(ts|tsx)$/.test(absPath)) return; // tests assert literals legitimately
	if (!isTsx) return;

	// b) JSX text nodes (English or any Latin prose)
	for (const m of src.matchAll(JSX_TEXT)) {
		const txt = m[1].replace(/\s+/g, ' ').trim();
		if (txt.length < 2) continue;
		if (AR.test(txt)) continue; // covered by rule (a)
		if (!/[A-Za-z]{2,}/.test(txt)) continue;
		const before = src.slice(Math.max(0, m.index - 300), m.index);
		if (isIconGlyph(txt, before)) continue;
		if (looksLikeCode(txt)) continue;
		push(src.slice(0, m.index).split('\n').length, 'hardcoded-en-jsx', `"${txt}"`);
	}

	// c) string attributes
	for (const m of src.matchAll(ATTR)) {
		const val = m[2].trim();
		if (AR.test(val)) continue; // rule (a)
		const wordy = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(val);
		if (!wordy || looksLikeCode(val)) continue;
		push(src.slice(0, m.index).split('\n').length, 'hardcoded-en-attr', `${m[1]}="${val}"`);
	}

	// d) toast / notification literals
	for (const m of src.matchAll(TOAST)) {
		const msg = m[3];
		if (AR.test(msg)) continue;
		if (!/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(msg)) continue;
		push(src.slice(0, m.index).split('\n').length, 'hardcoded-en-toast', msg.trim());
	}
	for (const m of src.matchAll(TPL_TOAST)) {
		const msg = m[2];
		if (AR.test(msg)) continue;
		if (!/\b[A-Za-z]{3,}\b\s+[A-Za-z]{3,}/.test(msg)) continue;
		if (!msg.includes('$')) continue; // plain backticks handled above
		push(src.slice(0, m.index).split('\n').length, 'hardcoded-en-toast', msg.trim());
	}
}

(function walk(dir, relBase = '') {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
		if (SKIP_DIRS.has(rel) || (entry.isDirectory() && entry.name === 'node_modules')) continue;
		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(abs, rel);
		else if (/\.(tsx?|jsx?)$/.test(entry.name)) scanFile(abs, `src/${rel}`);
	}
})(SRC_DIR);

// ─────────────────────────── report ───────────────────────────

console.log('═══════════ i18n gate ═══════════');
console.log(`en keys: ${enKeys.length}`);
for (const loc of LOCALES.slice(1)) console.log(`${loc} keys: ${Object.keys(dicts[loc]).length}`);
console.log(`hardcode violations: ${errors.filter((e) => e.includes('[hardcoded')).length}`);

if (REPORT && errors.length) {
	console.log('\n───── violations ─────');
	for (const e of errors) console.log(e);
}

if (warnings.length) {
	console.log('\n⚠️  warnings:');
	for (const w of warnings) console.log(w);
}

if (errors.length) {
	console.log(`\n❌ FAILED — ${errors.length} problem(s). Add every user-facing string to all four dictionaries and use t().`);
	process.exit(1);
}
console.log('\n✅ OK — full parity across fa/en/ru/zh, zero hardcoded strings.');
