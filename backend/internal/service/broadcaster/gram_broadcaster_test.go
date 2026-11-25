package broadcaster

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/service/cardgen"
)

type mockCryptoProvider struct {
	price    float64
	priceStr string
	ok       bool
}

func (m *mockCryptoProvider) GetPrice(symbol string) string {
	if m.priceStr != "" {
		return m.priceStr
	}
	return "$4.25"
}

func (m *mockCryptoProvider) GetFloatPrice(symbol string) (float64, bool) {
	if !m.ok && m.price == 0 {
		return 0, false
	}
	return m.price, true
}

type recordedTGCall struct {
	method    string
	noRetry   bool
	multipart bool
	payload   map[string]interface{}
	fields    map[string]string
	photoLen  int
}

type mockTelegramClient struct {
	calls         []recordedTGCall
	noRetryErr    error
	multipartErr  error
	noRetryResp   json.RawMessage
	multipartResp json.RawMessage
	standardResp  json.RawMessage
}

func (m *mockTelegramClient) Request(_ context.Context, method string, payload interface{}) (json.RawMessage, error) {
	pMap, _ := payload.(map[string]interface{})
	m.calls = append(m.calls, recordedTGCall{method: method, payload: pMap})
	if m.standardResp != nil {
		return m.standardResp, nil
	}
	return json.RawMessage(`{"message_id":101}`), nil
}

func (m *mockTelegramClient) RequestNoRetry(_ context.Context, method string, payload interface{}) (json.RawMessage, error) {
	pMap, _ := payload.(map[string]interface{})
	m.calls = append(m.calls, recordedTGCall{method: method, noRetry: true, payload: pMap})
	if m.noRetryErr != nil {
		return nil, m.noRetryErr
	}
	if m.noRetryResp != nil {
		return m.noRetryResp, nil
	}
	return json.RawMessage(`{"message_id":202}`), nil
}

func (m *mockTelegramClient) RequestMultipartNoRetry(_ context.Context, method string, fields map[string]string, files map[string][]byte) (json.RawMessage, error) {
	copiedFields := make(map[string]string, len(fields))
	for k, v := range fields {
		copiedFields[k] = v
	}
	m.calls = append(m.calls, recordedTGCall{
		method:    method,
		noRetry:   true,
		multipart: true,
		fields:    copiedFields,
		photoLen:  len(files["photo"]),
	})
	if m.multipartErr != nil {
		return nil, m.multipartErr
	}
	if m.multipartResp != nil {
		return m.multipartResp, nil
	}
	return json.RawMessage(`{"message_id":777}`), nil
}

func TestRecordPriceAndCleanup(t *testing.T) {
	b := &GramBroadcaster{
		cryptoSvc:    &mockCryptoProvider{price: 4.25, ok: true},
		priceHistory: make([]PriceTick, 0),
	}

	now := time.Now().UTC()

	// Add an old record (25 hours ago)
	b.priceHistory = append(b.priceHistory, PriceTick{
		Price:     4.10,
		Timestamp: now.Add(-25 * time.Hour),
	})

	// Add a record within 24 hours (10 hours ago)
	b.priceHistory = append(b.priceHistory, PriceTick{
		Price:     4.20,
		Timestamp: now.Add(-10 * time.Hour),
	})

	// Run cleanup
	b.recordPriceAndCleanup(now)

	// Check length: 25h old record should be purged, 10h old + new tick should remain
	if len(b.priceHistory) != 2 {
		t.Fatalf("expected 2 price ticks after cleanup, got %d", len(b.priceHistory))
	}

	if b.priceHistory[0].Price != 4.20 {
		t.Errorf("expected oldest tick price to be 4.20, got %.2f", b.priceHistory[0].Price)
	}

	if b.priceHistory[1].Price != 4.25 {
		t.Errorf("expected newest tick price to be 4.25, got %.2f", b.priceHistory[1].Price)
	}
}

func TestRecordPriceAndCleanup_AllExpiredPurged(t *testing.T) {
	b := &GramBroadcaster{
		cryptoSvc: &mockCryptoProvider{price: 0, ok: false},
		priceHistory: []PriceTick{
			{Price: 3.10, Timestamp: time.Now().UTC().Add(-30 * time.Hour)},
			{Price: 3.20, Timestamp: time.Now().UTC().Add(-26 * time.Hour)},
		},
	}

	b.recordPriceAndCleanup(time.Now().UTC())
	if len(b.priceHistory) != 0 {
		t.Fatalf("expected all expired ticks to be purged, got %d remaining", len(b.priceHistory))
	}
}

func TestSlotKeyRoundingAndScheduler(t *testing.T) {
	beforeBoundary := time.Date(2026, 11, 25, 10, 9, 59, 998_000_000, time.UTC)
	afterBoundary := time.Date(2026, 11, 25, 10, 10, 0, 2_000_000, time.UTC)

	k1 := slotKeyFor10Min(beforeBoundary)
	k2 := slotKeyFor10Min(afterBoundary)
	if k1 != k2 || k1 != "202611251010" {
		t.Fatalf("expected boundary timestamps to share slot 202611251010, got %q and %q", k1, k2)
	}

	next := nextBroadcasterSlot(time.Date(2026, 11, 25, 10, 10, 1, 200_000_000, time.UTC))
	want := time.Date(2026, 11, 25, 10, 20, 1, 0, time.UTC)
	if !next.Equal(want) {
		t.Fatalf("expected next slot %v, got %v", want, next)
	}
}

func TestBroadcast10MinPost_NoDuplicateAndMinimalFormat(t *testing.T) {
	tg := &mockTelegramClient{}
	t0 := time.Date(2026, 11, 25, 10, 10, 1, 0, time.UTC)

	b := &GramBroadcaster{
		tgClient:  tg,
		cryptoSvc: &mockCryptoProvider{price: 4.25, priceStr: "$4.25 (stale)", ok: true},
		target:    "@TheGramPrice",
		priceHistory: []PriceTick{
			{Price: 4.25, Timestamp: t0},
		},
	}

	// First send at 10:10:01 -> must send ONLY minimal "$4.25" using RequestNoRetry
	b.broadcast10MinPost(context.Background(), t0)
	if len(tg.calls) != 1 {
		t.Fatalf("expected 1 telegram call, got %d", len(tg.calls))
	}
	if !tg.calls[0].noRetry || tg.calls[0].method != "sendMessage" {
		t.Fatalf("expected RequestNoRetry sendMessage, got %+v", tg.calls[0])
	}
	if tg.calls[0].payload["text"] != "$4.25" {
		t.Fatalf("expected strictly minimal 10-min price '$4.25', got %v", tg.calls[0].payload["text"])
	}
	if len(tg.calls[0].payload) != 2 {
		t.Fatalf("expected no extra fields in 10-min payload, got %+v", tg.calls[0].payload)
	}

	// Duplicate trigger 2 seconds later -> MUST skip
	b.broadcast10MinPost(context.Background(), t0.Add(2*time.Second))
	// Cooldown trigger 5 minutes later (even though Round maps to next slot) -> MUST skip
	b.broadcast10MinPost(context.Background(), t0.Add(5*time.Minute+30*time.Second))
	if len(tg.calls) != 1 {
		t.Fatalf("expected duplicate/cooldown calls to be blocked, got %d total calls", len(tg.calls))
	}

	// Stale tick (>25m old) -> MUST skip
	b.broadcast10MinPost(context.Background(), t0.Add(40*time.Minute))
	if len(tg.calls) != 1 {
		t.Fatalf("expected stale tick to be skipped, got %d total calls", len(tg.calls))
	}
}

func TestCheckAndSendDailyRecap_ViralPhotoAndPinning(t *testing.T) {
	tg := &mockTelegramClient{
		multipartResp: json.RawMessage(`{"message_id":777}`),
	}
	recapNow := time.Date(2026, 11, 25, 0, 0, 1, 0, time.UTC)

	history := []PriceTick{
		{Price: 5.17, Timestamp: recapNow.Add(-24 * time.Hour)},
		{Price: 5.08, Timestamp: recapNow.Add(-20 * time.Hour)},
		{Price: 5.56, Timestamp: recapNow.Add(-6 * time.Hour)},
		{Price: 5.42, Timestamp: recapNow},
	}

	b := &GramBroadcaster{
		tgClient:     tg,
		cardGen:      cardgen.NewCardGenerator(),
		target:       "@TheGramPrice",
		priceHistory: history,
		dailyCloses: []dailyCloseRecord{
			{Date: "2026-11-22", Close: 4.85, PctChange: 2.1},
			{Date: "2026-11-23", Close: 5.17, PctChange: 6.6},
		},
	}

	b.checkAndSendDailyRecap(context.Background(), recapNow)

	// Expect: 1) unpinAllChatMessages, 2) sendPhoto (multipart no-retry), 3) pinChatMessage(777)
	if len(tg.calls) != 3 {
		t.Fatalf("expected 3 calls (unpin, sendPhoto, pin), got %d: %+v", len(tg.calls), tg.calls)
	}
	if tg.calls[0].method != "unpinAllChatMessages" {
		t.Fatalf("expected unpinAllChatMessages first, got %s", tg.calls[0].method)
	}
	photoCall := tg.calls[1]
	if photoCall.method != "sendPhoto" || !photoCall.multipart || !photoCall.noRetry {
		t.Fatalf("expected multipart no-retry sendPhoto, got %+v", photoCall)
	}
	if photoCall.photoLen < 10_000 {
		t.Fatalf("expected valid rendered PNG card bytes, got %d bytes", photoCall.photoLen)
	}
	caption := photoCall.fields["caption"]
	for _, want := range []string{"TONCOIN DAILY RECAP", "$5.420", "+$0.250", "3-Day Green Streak", "@TheGramPrice"} {
		if !strings.Contains(caption, want) {
			t.Errorf("expected caption to contain %q, got:\n%s", want, caption)
		}
	}
	if !strings.Contains(photoCall.fields["reply_markup"], "https://t.me/share/url") {
		t.Errorf("expected share/forward inline button markup, got %s", photoCall.fields["reply_markup"])
	}
	pinCall := tg.calls[2]
	if pinCall.method != "pinChatMessage" || pinCall.payload["message_id"] != int64(777) {
		t.Fatalf("expected pinChatMessage with msg_id 777, got %+v", pinCall)
	}

	// Second trigger in same hour -> MUST NOT duplicate
	b.checkAndSendDailyRecap(context.Background(), recapNow.Add(10*time.Minute))
	if len(tg.calls) != 3 {
		t.Fatalf("expected duplicate daily recap to be skipped, got %d calls", len(tg.calls))
	}
}

func TestCheckAndSendDailyRecap_TimeoutDoesNotDoubleSend(t *testing.T) {
	tg := &mockTelegramClient{
		multipartErr: errors.New("context deadline exceeded"),
	}
	recapNow := time.Date(2026, 11, 25, 0, 0, 1, 0, time.UTC)

	b := &GramBroadcaster{
		tgClient: tg,
		cardGen:  cardgen.NewCardGenerator(),
		target:   "@TheGramPrice",
		priceHistory: []PriceTick{
			{Price: 5.00, Timestamp: recapNow.Add(-12 * time.Hour)},
			{Price: 5.10, Timestamp: recapNow},
		},
	}

	b.checkAndSendDailyRecap(context.Background(), recapNow)
	// Must NOT fall back to sendMessage on ambiguous network/timeout error
	for _, c := range tg.calls {
		if c.method == "sendMessage" {
			t.Fatalf("unexpected sendMessage fallback after network timeout (would risk duplicate)")
		}
	}

	// Explicit Telegram 400 APIError -> SHOULD fall back to sendMessage
	tg2 := &mockTelegramClient{
		multipartErr: &telegram.APIError{Code: 400, Message: "Bad Request: photo rejected"},
		noRetryResp:  json.RawMessage(`{"message_id":888}`),
	}
	b2 := &GramBroadcaster{
		tgClient: tg2,
		cardGen:  cardgen.NewCardGenerator(),
		target:   "@TheGramPrice",
		priceHistory: []PriceTick{
			{Price: 5.00, Timestamp: recapNow.Add(-12 * time.Hour)},
			{Price: 5.10, Timestamp: recapNow},
		},
	}
	b2.checkAndSendDailyRecap(context.Background(), recapNow)
	if len(tg2.calls) != 4 || tg2.calls[2].method != "sendMessage" || tg2.calls[3].method != "pinChatMessage" {
		t.Fatalf("expected APIError fallback to sendMessage + pinChatMessage, got %+v", tg2.calls)
	}
}

func TestExtractMessageID(t *testing.T) {
	wrappedResp := []byte(`{"ok":true,"result":{"message_id":12345,"date":1600000000}}`)
	if msgID := extractMessageID(wrappedResp); msgID != 12345 {
		t.Fatalf("expected wrapped message_id 12345, got %d", msgID)
	}

	directResp := []byte(`{"message_id":67890,"date":1600000000}`)
	if msgID := extractMessageID(directResp); msgID != 67890 {
		t.Fatalf("expected direct message_id 67890, got %d", msgID)
	}
}
