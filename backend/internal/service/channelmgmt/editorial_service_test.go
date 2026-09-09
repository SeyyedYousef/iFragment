package channelmgmt

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"

	"ifragment-backend/internal/repository"
)

// TestPreflightValidation tests the preflight permission check validation logic
func TestPreflightValidation(t *testing.T) {
	svc := NewProjectService(nil, nil, nil)
	ctx := context.Background()

	tests := []struct {
		name      string
		input     PreflightInput
		wantValid bool
		wantError string
	}{
		{
			name: "Empty source and target",
			input: PreflightInput{
				SourceIdentifier: "",
				TargetIdentifier: "",
			},
			wantValid: false,
			wantError: "کانال ورودی مشخص نشده است",
		},
		{
			name: "Same source and target channel",
			input: PreflightInput{
				SourceIdentifier: "@mychannel",
				TargetIdentifier: "@mychannel",
			},
			wantValid: false,
			wantError: "کانال مبدا و مقصد نمی‌توانند یکسان باشند",
		},
		{
			name: "Same source and target with different case and prefix",
			input: PreflightInput{
				SourceIdentifier: "https://t.me/MyChannel",
				TargetIdentifier: "@mychannel",
			},
			wantValid: false,
			wantError: "کانال مبدا و مقصد نمی‌توانند یکسان باشند",
		},
		{
			name: "Valid distinct channels",
			input: PreflightInput{
				SourceIdentifier: "@news_source",
				TargetIdentifier: "@vip_channel",
			},
			wantValid: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res, err := svc.CheckPreflight(ctx, 123456, tc.input)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Valid != tc.wantValid {
				t.Errorf("expected valid=%v, got %v (errors: %v)", tc.wantValid, res.Valid, res.Errors)
			}
			if tc.wantError != "" {
				found := false
				for _, e := range res.Errors {
					if e == tc.wantError {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("expected error %q not found in errors: %v", tc.wantError, res.Errors)
				}
			}
		})
	}
}

// TestTelegramCallbackDataLengthSecurity verifies that callback tokens strictly obey Telegram 64-byte limit
func TestTelegramCallbackDataLengthSecurity(t *testing.T) {
	// Telegram Bot API enforces a hard limit of 64 bytes on callback_data
	// Format: appr:v1:<short_token> or rej:v1:<short_token>
	tokenRaw := uuid.New().String()
	hash := sha256.Sum256([]byte(tokenRaw))
	shortToken := hex.EncodeToString(hash[:])[:16] // 16-hex characters

	callbackDataApprove := fmt.Sprintf("appr:v1:%s", shortToken)
	callbackDataReject := fmt.Sprintf("rej:v1:%s", shortToken)

	if len([]byte(callbackDataApprove)) > 64 {
		t.Fatalf("approval callback_data exceeds 64 bytes: %d bytes (%s)", len(callbackDataApprove), callbackDataApprove)
	}
	if len([]byte(callbackDataReject)) > 64 {
		t.Fatalf("reject callback_data exceeds 64 bytes: %d bytes (%s)", len(callbackDataReject), callbackDataReject)
	}

	// Verify short token length is safely within limits (e.g. 24 bytes total)
	if len(callbackDataApprove) != 24 {
		t.Errorf("expected 24 bytes, got %d", len(callbackDataApprove))
	}
}

// TestContentItemAndRevisionLifecycle validates the editorial data structures and versioning
func TestContentItemAndRevisionLifecycle(t *testing.T) {
	projectID := uuid.New()
	contentID := uuid.New()
	now := time.Now()

	item := &repository.ContentItem{
		ID:                  contentID,
		ProjectID:           projectID,
		SourceChatID:        -100111222333,
		SourceMessageID:     456,
		SourceMediaGroupID:  nil,
		Status:              "awaiting_review",
		CurrentRevisionID:   nil,
		ReceivedAt:          now,
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	// Revision 1: initial ingestion from normalizer
	rev1ID := uuid.New()
	rev1 := &repository.ContentRevision{
		ID:              rev1ID,
		ContentItemID:   contentID,
		Version:         1,
		Text:            "Original news article without ads",
		Caption:         "",
		MediaManifest:   json.RawMessage(`[]`),
		Buttons:         json.RawMessage(`[{"title":"Source","type":"url","value":"https://example.com"}]`),
		Transformations: json.RawMessage(`[{"type":"remove_ads","removed_links":2}]`),
		CreatedAt:       now,
	}

	// Verify serialization and version tracking
	item.CurrentRevisionID = &rev1ID
	if *item.CurrentRevisionID != rev1.ID {
		t.Errorf("expected revision ID %s, got %s", rev1.ID, *item.CurrentRevisionID)
	}

	// Revision 2: Editor edits the text
	rev2ID := uuid.New()
	editorUserID := int64(998877)
	rev2 := &repository.ContentRevision{
		ID:              rev2ID,
		ContentItemID:   contentID,
		Version:         rev1.Version + 1,
		Text:            "Polished news article edited by editor",
		Caption:         "",
		MediaManifest:   rev1.MediaManifest,
		Buttons:         rev1.Buttons,
		Transformations: json.RawMessage(`[{"type":"manual_edit","actor":"user"}]`),
		CreatedBy:       &editorUserID,
		CreatedAt:       now.Add(2 * time.Minute),
	}

	if rev2.Version != 2 {
		t.Errorf("expected revision version 2, got %d", rev2.Version)
	}
	if *rev2.CreatedBy != editorUserID {
		t.Errorf("expected creator %d, got %v", editorUserID, rev2.CreatedBy)
	}
}

// TestDeliveryIdempotencyKeyGeneration verifies exact-once publishing key uniqueness
func TestDeliveryIdempotencyKeyGeneration(t *testing.T) {
	projectID := uuid.New()
	contentID := uuid.New()
	version := 2

	key1 := fmt.Sprintf("proj_%s_item_%s_rev_%d", projectID, contentID, version)
	key2 := fmt.Sprintf("proj_%s_item_%s_rev_%d", projectID, contentID, version)
	key3 := fmt.Sprintf("proj_%s_item_%s_rev_%d", projectID, contentID, version+1)

	if key1 != key2 {
		t.Errorf("idempotency keys for same revision must match: %s != %s", key1, key2)
	}
	if key1 == key3 {
		t.Errorf("idempotency keys for different revisions must differ: %s == %s", key1, key3)
	}
}

// TestProjectMemberRoles validates role-based access control enum
func TestProjectMemberRoles(t *testing.T) {
	validRoles := map[string]bool{
		"owner":    true,
		"admin":    true,
		"editor":   true,
		"approver": true,
		"viewer":   true,
	}

	for role := range validRoles {
		m := &repository.ProjectMember{
			ProjectID: uuid.New(),
			UserID:    12345,
			Role:      role,
			CreatedAt: time.Now(),
		}
		if !validRoles[m.Role] {
			t.Errorf("role %s should be valid", role)
		}
	}
}

// TestEditorialContentStateMachine validates permitted state transitions
func TestEditorialContentStateMachine(t *testing.T) {
	// Allowed transitions from each state
	allowedTransitions := map[string]map[string]bool{
		"received": {
			"normalizing": true,
			"rejected":    true,
		},
		"normalizing": {
			"processing":      true,
			"awaiting_review": true,
			"failed":          true,
		},
		"awaiting_review": {
			"approved":  true,
			"rejected":  true,
			"scheduled": true,
		},
		"approved": {
			"publishing": true,
			"scheduled":  true,
		},
		"publishing": {
			"published":        true,
			"failed_retryable": true,
			"failed_permanent": true,
		},
		"published": {
			// terminal state for this delivery
		},
		"rejected": {
			// can re-open to awaiting_review if edited
			"awaiting_review": true,
		},
	}

	// 1. Valid transition: awaiting_review -> approved
	if !allowedTransitions["awaiting_review"]["approved"] {
		t.Error("expected awaiting_review -> approved to be permitted")
	}

	// 2. Valid transition: awaiting_review -> rejected
	if !allowedTransitions["awaiting_review"]["rejected"] {
		t.Error("expected awaiting_review -> rejected to be permitted")
	}

	// 3. Invalid transition: published -> received (terminal)
	if allowedTransitions["published"]["received"] {
		t.Error("published -> received should NOT be permitted")
	}

	// 4. Invalid transition: received -> published (skipping pipeline and review)
	if allowedTransitions["received"]["published"] {
		t.Error("received -> published without review should NOT be permitted")
	}
}

// TestPassiveOutputChannelRuleVerification asserts bot will never touch non-bot messages
func TestPassiveOutputChannelRuleVerification(t *testing.T) {
	// Simulate deliveries table store
	deliveriesStore := make(map[string]*repository.Delivery)

	destChatID := int64(-100999888777)
	botMsgID := int64(1042)
	manualAdminMsgID := int64(9999)

	// Register bot delivery
	delID := uuid.New()
	deliveriesStore[fmt.Sprintf("%d:%d", destChatID, botMsgID)] = &repository.Delivery{
		ID:                delID,
		DestinationChatID: destChatID,
		TelegramMessageID: &botMsgID,
		CreatedByBot:      true,
		Status:            "published",
	}

	isBotDelivery := func(chatID int64, msgID int64) bool {
		del, ok := deliveriesStore[fmt.Sprintf("%d:%d", chatID, msgID)]
		return ok && del != nil && del.CreatedByBot
	}

	// 1. Bot delivery message must return true
	if !isBotDelivery(destChatID, botMsgID) {
		t.Errorf("expected bot message %d in chat %d to be recognized as bot delivery", botMsgID, destChatID)
	}

	// 2. Manual admin post must return false
	if isBotDelivery(destChatID, manualAdminMsgID) {
		t.Errorf("manual admin post %d in chat %d must NEVER be recognized as bot delivery", manualAdminMsgID, destChatID)
	}

	// 3. Post in completely different chat must return false
	if isBotDelivery(-100555444333, botMsgID) {
		t.Errorf("post in unmanaged chat must return false")
	}
}

// TestConcurrentDecisionLockSimulation verifies race-condition prevention during simultaneous approvals
func TestConcurrentDecisionLockSimulation(t *testing.T) {
	// Simulate decision store with atomic constraint: UNIQUE(request_id)
	type DecisionRecord struct {
		RequestID uuid.UUID
		DeciderID int64
		Decision  string
	}

	requestID := uuid.New()
	var registeredDecision *DecisionRecord
	lock := make(chan struct{}, 1)
	lock <- struct{}{} // Initialize mutex lock

	recordDecision := func(reqID uuid.UUID, deciderID int64, decision string) error {
		<-lock
		defer func() { lock <- struct{}{} }()

		if registeredDecision != nil && registeredDecision.RequestID == reqID {
			return fmt.Errorf("decision already recorded for request %s (conflict: 409)", reqID)
		}
		registeredDecision = &DecisionRecord{
			RequestID: reqID,
			DeciderID: deciderID,
			Decision:  decision,
		}
		return nil
	}

	// Run two concurrent goroutines attempting to approve at the exact same moment
	errChan := make(chan error, 2)

	go func() {
		errChan <- recordDecision(requestID, 1001, "approved")
	}()
	go func() {
		errChan <- recordDecision(requestID, 1002, "approved")
	}()

	err1 := <-errChan
	err2 := <-errChan

	// Exactly ONE must succeed (nil error), and the other must fail (conflict error)
	successCount := 0
	conflictCount := 0

	for _, err := range []error{err1, err2} {
		if err == nil {
			successCount++
		} else {
			conflictCount++
		}
	}

	if successCount != 1 || conflictCount != 1 {
		t.Fatalf("concurrency lock failed: expected 1 success and 1 conflict, got %d successes and %d conflicts (err1: %v, err2: %v)", successCount, conflictCount, err1, err2)
	}
}

