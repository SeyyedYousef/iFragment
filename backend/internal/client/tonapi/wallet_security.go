package tonapi

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// WalletSecurityAudit is a read-only on-chain security snapshot of a TON wallet contract.
// It inspects contract interfaces (wallet_v5r1 / wallet_v4r2 / v3r2 / multisig), TonAPI scam
// flags, W5 owner signature authorization (is_signature_allowed), and installed extensions/plugins.
type WalletSecurityAudit struct {
	Address          string   `json:"address"`
	ResolvedFrom     string   `json:"resolved_from,omitempty"`
	Status           string   `json:"status"`         // active | uninit | frozen | nonexist
	BalanceTON       float64  `json:"balance_ton"`
	WalletVersion    string   `json:"wallet_version"` // wallet_v5r1 | wallet_v4r2 | wallet_v3r2 | ...
	Interfaces       []string `json:"interfaces"`
	IsScam           bool     `json:"is_scam"`
	SignatureAllowed *bool    `json:"signature_allowed,omitempty"` // populated for wallet_v5r1
	HasExtensions    bool     `json:"has_extensions"`
	ExtensionsCount  int      `json:"extensions_count"`
	Extensions       []string `json:"extensions,omitempty"`
	SecurityLevel    string   `json:"security_level"` // safe | caution | critical | uninit
	RiskFlags        []string `json:"risk_flags"`
	CheckedAt        string   `json:"checked_at"`
}

type accountDetailResponse struct {
	Address      string   `json:"address"`
	Balance      int64    `json:"balance"`
	Status       string   `json:"status"`
	Interfaces   []string `json:"interfaces"`
	IsScam       bool     `json:"is_scam"`
	Name         string   `json:"name"`
	LastActivity int64    `json:"last_activity"`
}

type runGetMethodResponse struct {
	Success  bool                   `json:"success"`
	ExitCode int                    `json:"exit_code"`
	Stack    []tvmStackEntry        `json:"stack"`
	Decoded  map[string]interface{} `json:"decoded"`
}

type tvmStackEntry struct {
	Type  string `json:"type"`
	Num   string `json:"num,omitempty"`
	Cell  string `json:"cell,omitempty"`
	Slice string `json:"slice,omitempty"`
}

// RunGetMethod executes a read-only TVM get-method against an account via TonAPI.
func (c *Client) RunGetMethod(ctx context.Context, address string, methodName string) (*runGetMethodResponse, error) {
	if !IsValidTONAddress(address) {
		return nil, fmt.Errorf("invalid TON address: %s", address)
	}
	endpoint := fmt.Sprintf(
		"%s/blockchain/accounts/%s/methods/%s",
		c.BaseURL,
		url.PathEscape(address),
		url.PathEscape(methodName),
	)
	resp, err := c.doRequest(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi runGetMethod(%s) error: %s", methodName, resp.Status)
	}

	var out runGetMethodResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

// AuditWalletSecurity performs a defensive read-only on-chain inspection of a TON wallet address
// (or .ton DNS domain) to detect W5 extensions, V4 plugins, W5 signature lockouts, and scam flags.
func (c *Client) AuditWalletSecurity(ctx context.Context, rawTarget string) (*WalletSecurityAudit, error) {
	target := strings.TrimSpace(rawTarget)
	if target == "" {
		return nil, fmt.Errorf("address is required")
	}

	resolvedFrom := ""
	address := target
	if strings.HasSuffix(strings.ToLower(target), ".ton") {
		dnsRes, err := c.ResolveDNS(ctx, strings.ToLower(target))
		if err != nil || dnsRes == nil || dnsRes.Wallet.Address == "" {
			return nil, fmt.Errorf("failed to resolve TON DNS domain: %s", target)
		}
		resolvedFrom = strings.ToLower(target)
		address = dnsRes.Wallet.Address
	}

	if !IsValidTONAddress(address) {
		return nil, fmt.Errorf("invalid TON address: %s", target)
	}

	accountURL := fmt.Sprintf("%s/accounts/%s", c.BaseURL, url.PathEscape(address))
	resp, err := c.doRequest(ctx, accountURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return &WalletSecurityAudit{
			Address:       address,
			ResolvedFrom:  resolvedFrom,
			Status:        "nonexist",
			WalletVersion: "uninitialized",
			Interfaces:    []string{},
			SecurityLevel: "uninit",
			RiskFlags:     []string{},
			CheckedAt:     time.Now().UTC().Format(time.RFC3339),
		}, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi account error: %s", resp.Status)
	}

	var acc accountDetailResponse
	if err := json.NewDecoder(resp.Body).Decode(&acc); err != nil {
		return nil, err
	}

	canonicalAddr := address
	if acc.Address != "" {
		canonicalAddr = acc.Address
	}

	balanceTON := math.Round((float64(acc.Balance)/1e9)*1000) / 1000
	interfaces := acc.Interfaces
	if interfaces == nil {
		interfaces = []string{}
	}

	walletVersion := detectPrimaryWalletInterface(interfaces, acc.Status)
	audit := &WalletSecurityAudit{
		Address:       canonicalAddr,
		ResolvedFrom:  resolvedFrom,
		Status:        acc.Status,
		BalanceTON:    balanceTON,
		WalletVersion: walletVersion,
		Interfaces:    interfaces,
		IsScam:        acc.IsScam,
		RiskFlags:     []string{},
		CheckedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	if acc.IsScam {
		audit.RiskFlags = append(audit.RiskFlags, "SCAM_FLAG")
	}

	// Only inspect TVM get-methods on active wallet contracts.
	if strings.EqualFold(acc.Status, "active") {
		verLower := strings.ToLower(walletVersion)
		switch {
		case strings.Contains(verLower, "wallet_v5"):
			if sigRes, sigErr := c.RunGetMethod(ctx, address, "is_signature_allowed"); sigErr == nil && sigRes != nil && sigRes.Success {
				allowed := parseSignatureAllowed(sigRes)
				audit.SignatureAllowed = &allowed
				if !allowed {
					audit.RiskFlags = append(audit.RiskFlags, "W5_SIGNATURE_LOCKED")
				}
			}
			if extRes, extErr := c.RunGetMethod(ctx, address, "get_extensions"); extErr == nil && extRes != nil && extRes.Success {
				exts, hasAny := parseExtensionList(extRes)
				if hasAny {
					audit.HasExtensions = true
					audit.Extensions = exts
					if len(exts) > 0 {
						audit.ExtensionsCount = len(exts)
					} else {
						audit.ExtensionsCount = 1
					}
					audit.RiskFlags = append(audit.RiskFlags, "ACTIVE_EXTENSIONS")
				}
			}
		case strings.Contains(verLower, "wallet_v4"):
			if plugRes, plugErr := c.RunGetMethod(ctx, address, "get_plugin_list"); plugErr == nil && plugRes != nil && plugRes.Success {
				plugins, hasAny := parseExtensionList(plugRes)
				if hasAny {
					audit.HasExtensions = true
					audit.Extensions = plugins
					if len(plugins) > 0 {
						audit.ExtensionsCount = len(plugins)
					} else {
						audit.ExtensionsCount = 1
					}
					audit.RiskFlags = append(audit.RiskFlags, "ACTIVE_PLUGINS")
				}
			}
		}
	}

	// Compute deterministic security level.
	switch {
	case audit.IsScam || (audit.SignatureAllowed != nil && !*audit.SignatureAllowed):
		audit.SecurityLevel = "critical"
	case audit.HasExtensions || audit.ExtensionsCount > 0:
		audit.SecurityLevel = "caution"
	case strings.EqualFold(acc.Status, "uninit") || strings.EqualFold(acc.Status, "nonexist"):
		audit.SecurityLevel = "uninit"
	default:
		audit.SecurityLevel = "safe"
	}

	return audit, nil
}

func detectPrimaryWalletInterface(interfaces []string, status string) string {
	for _, iface := range interfaces {
		low := strings.ToLower(strings.TrimSpace(iface))
		if strings.HasPrefix(low, "wallet_") || strings.Contains(low, "highload") || strings.Contains(low, "multisig") {
			return low
		}
	}
	if len(interfaces) > 0 {
		return strings.ToLower(strings.TrimSpace(interfaces[0]))
	}
	if strings.EqualFold(status, "uninit") || strings.EqualFold(status, "nonexist") {
		return "uninitialized"
	}
	return "smart_contract"
}

func parseSignatureAllowed(res *runGetMethodResponse) bool {
	if res.Decoded != nil {
		for _, k := range []string{"is_signature_allowed", "signature_allowed", "allowed"} {
			if raw, ok := res.Decoded[k]; ok {
				switch v := raw.(type) {
				case bool:
					return v
				case float64:
					return v != 0
				case string:
					low := strings.ToLower(strings.TrimSpace(v))
					return low == "true" || low == "-1" || low == "1"
				}
			}
		}
	}
	if len(res.Stack) > 0 && res.Stack[0].Type == "num" {
		num := strings.ToLower(strings.TrimSpace(res.Stack[0].Num))
		if num == "" || num == "0" || num == "0x0" || num == "0x00" {
			return false
		}
		return true
	}
	// Default conservative true if TonAPI returned success without a zero stack value.
	return true
}

func parseExtensionList(res *runGetMethodResponse) ([]string, bool) {
	var found []string
	seen := make(map[string]struct{})
	addAddr := func(s string) {
		trimmed := strings.TrimSpace(s)
		if trimmed == "" {
			return
		}
		if _, dup := seen[trimmed]; !dup {
			seen[trimmed] = struct{}{}
			found = append(found, trimmed)
		}
	}

	// 1. Inspect TonAPI decoded payload (extensions / plugins array of strings or objects).
	if res.Decoded != nil {
		for _, key := range []string{"extensions", "plugins"} {
			raw, ok := res.Decoded[key]
			if !ok || raw == nil {
				continue
			}
			if list, isSlice := raw.([]interface{}); isSlice {
				for _, item := range list {
					switch v := item.(type) {
					case string:
						addAddr(v)
					case map[string]interface{}:
						if addr, ok := v["address"].(string); ok {
							addAddr(addr)
						}
					}
				}
			}
		}
		if len(found) > 0 {
			return found, true
		}
	}

	// 2. Fallback to raw TVM stack inspection: empty dict/list is type == "null".
	if len(res.Stack) > 0 {
		top := res.Stack[0]
		t := strings.ToLower(strings.TrimSpace(top.Type))
		if t != "" && t != "null" {
			// Non-null cell/tuple/slice returned from get_extensions / get_plugin_list means active entry exists.
			if t == "num" {
				n := strings.ToLower(strings.TrimSpace(top.Num))
				if n != "" && n != "0" && n != "0x0" {
					return found, true
				}
				return nil, false
			}
			return found, true
		}
	}

	return nil, false
}
