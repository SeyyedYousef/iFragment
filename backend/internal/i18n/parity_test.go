package i18n

import (
	"fmt"
	"strings"
	"testing"
)

func flattenDictKeys(prefix string, m map[string]interface{}, out map[string]string) {
	for k, v := range m {
		full := k
		if prefix != "" {
			full = prefix + "." + k
		}
		switch typed := v.(type) {
		case map[string]interface{}:
			flattenDictKeys(full, typed, out)
		case string:
			out[full] = typed
		default:
			out[full] = fmt.Sprintf("%v", typed)
		}
	}
}

func TestAllDictionariesFullKeyParity(t *testing.T) {
	dicts := map[string]map[string]interface{}{
		"en": enDict,
		"fa": faDict,
		"ru": ruDict,
		"zh": zhDict,
	}

	flat := make(map[string]map[string]string, len(dicts))
	for lang, d := range dicts {
		flat[lang] = make(map[string]string)
		flattenDictKeys("", d, flat[lang])
	}

	base := flat["en"]
	for _, lang := range []string{"fa", "ru", "zh"} {
		target := flat[lang]
		for k, enVal := range base {
			val, ok := target[k]
			if !ok {
				t.Errorf("[%s] missing translation key %q (en=%q)", lang, k, enVal)
				continue
			}
			if strings.TrimSpace(val) == "" {
				t.Errorf("[%s] empty value for key %q", lang, k)
			}
			if len(enVal) > 12 && val == enVal && k != "common.prompt" {
				t.Errorf("[%s] untranslated English value copied verbatim for key %q", lang, k)
			}
		}
		for k := range target {
			if _, ok := base[k]; !ok {
				t.Errorf("[%s] extra translation key %q not present in enDict", lang, k)
			}
		}
	}
}

func TestZhDictContainsNoRussianLeakage(t *testing.T) {
	flatZh := make(map[string]string)
	flattenDictKeys("", zhDict, flatZh)

	for k, v := range flatZh {
		if k == "language.prompt" {
			continue
		}
		for _, r := range v {
			if r >= 0x0400 && r <= 0x04FF {
				t.Errorf("zhDict key %q contains unexpected Cyrillic character %q: %s", k, r, v)
				break
			}
		}
	}
}

func TestPaymentCreditsKeysFormatCorrectly(t *testing.T) {
	for _, lang := range []string{"en", "fa", "ru", "zh"} {
		msg := T(lang, "payments.credits_pack_success", map[string]interface{}{"credits": 10})
		if msg == "payments.credits_pack_success" || !strings.Contains(msg, "10") {
			t.Errorf("[%s] unexpected payments.credits_pack_success formatting: %q", lang, msg)
		}
		refund := T(lang, "payments.credits_pack_refunded", nil)
		if refund == "payments.credits_pack_refunded" || strings.TrimSpace(refund) == "" {
			t.Errorf("[%s] missing payments.credits_pack_refunded", lang)
		}
		pending := T(lang, "payments.credits_pack_pending_support", nil)
		if pending == "payments.credits_pack_pending_support" || strings.TrimSpace(pending) == "" {
			t.Errorf("[%s] missing payments.credits_pack_pending_support", lang)
		}
	}
}
