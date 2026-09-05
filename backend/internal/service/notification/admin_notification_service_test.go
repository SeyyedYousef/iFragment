package notification

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"ifragment-backend/internal/client/telegram"
)

func TestAdminNotificationService_TopicFallbacks(t *testing.T) {
	// Set AVM topic but leave GIFTS and NUMBERS empty
	_ = os.Setenv("ADMIN_GROUP_ID", "-1001234567890")
	_ = os.Setenv("ADMIN_TOPIC_AVM", "50")
	_ = os.Unsetenv("ADMIN_TOPIC_GIFTS")
	_ = os.Unsetenv("ADMIN_TOPIC_NUMBERS")
	defer func() {
		_ = os.Unsetenv("ADMIN_GROUP_ID")
		_ = os.Unsetenv("ADMIN_TOPIC_AVM")
	}()

	svc := NewAdminNotificationService()
	defer svc.Stop()

	if svc.adminGroupID != -1001234567890 {
		t.Fatalf("expected adminGroupID -1001234567890, got %d", svc.adminGroupID)
	}

	if svc.topicAVM == nil || *svc.topicAVM != 50 {
		t.Fatalf("expected topicAVM 50, got %v", svc.topicAVM)
	}

	// Should fallback to topicAVM (50)
	if svc.topicGifts == nil || *svc.topicGifts != 50 {
		t.Fatalf("expected topicGifts to fallback to 50, got %v", svc.topicGifts)
	}
	if svc.topicNumbers == nil || *svc.topicNumbers != 50 {
		t.Fatalf("expected topicNumbers to fallback to 50, got %v", svc.topicNumbers)
	}
}

func TestAdminNotificationService_ExplicitTopics(t *testing.T) {
	_ = os.Setenv("ADMIN_GROUP_ID", "-1001234567890")
	_ = os.Setenv("ADMIN_TOPIC_AVM", "50")
	_ = os.Setenv("ADMIN_TOPIC_GIFTS", "55")
	_ = os.Setenv("ADMIN_TOPIC_NUMBERS", "56")
	_ = os.Setenv("ADMIN_TOPIC_PAYMENTS", "52")
	_ = os.Setenv("ADMIN_TOPIC_NEW_BOT", "53")
	_ = os.Setenv("ADMIN_TOPIC_NEW_CHANNEL", "54")
	_ = os.Setenv("ADMIN_TOPIC_SYSTEM", "99")
	defer func() {
		_ = os.Unsetenv("ADMIN_GROUP_ID")
		_ = os.Unsetenv("ADMIN_TOPIC_AVM")
		_ = os.Unsetenv("ADMIN_TOPIC_GIFTS")
		_ = os.Unsetenv("ADMIN_TOPIC_NUMBERS")
		_ = os.Unsetenv("ADMIN_TOPIC_PAYMENTS")
		_ = os.Unsetenv("ADMIN_TOPIC_NEW_BOT")
		_ = os.Unsetenv("ADMIN_TOPIC_NEW_CHANNEL")
		_ = os.Unsetenv("ADMIN_TOPIC_SYSTEM")
	}()

	svc := NewAdminNotificationService()
	defer svc.Stop()

	if svc.topicGifts == nil || *svc.topicGifts != 55 {
		t.Fatalf("expected topicGifts 55, got %v", svc.topicGifts)
	}
	if svc.topicNumbers == nil || *svc.topicNumbers != 56 {
		t.Fatalf("expected topicNumbers 56, got %v", svc.topicNumbers)
	}
	if svc.topicPayments == nil || *svc.topicPayments != 52 {
		t.Fatalf("expected topicPayments 52, got %v", svc.topicPayments)
	}
	if svc.topicNewBot == nil || *svc.topicNewBot != 53 {
		t.Fatalf("expected topicNewBot 53, got %v", svc.topicNewBot)
	}
	if svc.topicNewChannel == nil || *svc.topicNewChannel != 54 {
		t.Fatalf("expected topicNewChannel 54, got %v", svc.topicNewChannel)
	}
	if svc.topicSystem == nil || *svc.topicSystem != 99 {
		t.Fatalf("expected topicSystem 99, got %v", svc.topicSystem)
	}
}

func TestAdminNotificationService_EnqueueJobs(t *testing.T) {
	_ = os.Setenv("ADMIN_GROUP_ID", "-1001234567890")
	_ = os.Setenv("ADMIN_TOPIC_AVM", "50")
	_ = os.Setenv("ADMIN_TOPIC_GIFTS", "55")
	_ = os.Setenv("ADMIN_TOPIC_NUMBERS", "56")
	defer func() {
		_ = os.Unsetenv("ADMIN_GROUP_ID")
		_ = os.Unsetenv("ADMIN_TOPIC_AVM")
		_ = os.Unsetenv("ADMIN_TOPIC_GIFTS")
		_ = os.Unsetenv("ADMIN_TOPIC_NUMBERS")
	}()

	svc := &AdminNotificationService{
		adminGroupID: -1001234567890,
		topicAVM:     intPtr(50),
		topicGifts:   intPtr(55),
		topicNumbers: intPtr(56),
		queue:        make(chan notificationJob, 50),
		stopCh:       make(chan struct{}),
	}

	ctx := context.Background()
	kb := telegram.BuildInlineKeyboard([][]telegram.InlineButton{
		{{Text: "Test", URL: "https://t.me"}},
	})

	svc.NotifyAVM(ctx, "AVM test", kb)
	svc.NotifyGift(ctx, "Gift test", kb)
	svc.NotifyNumber(ctx, "Number test", kb)

	if len(svc.queue) != 3 {
		t.Fatalf("expected 3 jobs in queue, got %d", len(svc.queue))
	}

	job1 := <-svc.queue
	if job1.text != "AVM test" || *job1.topicID != 50 || job1.markup == nil {
		t.Fatalf("job1 mismatch: %+v", job1)
	}

	job2 := <-svc.queue
	if job2.text != "Gift test" || *job2.topicID != 55 {
		t.Fatalf("job2 mismatch: %+v", job2)
	}

	job3 := <-svc.queue
	if job3.text != "Number test" || *job3.topicID != 56 {
		t.Fatalf("job3 mismatch: %+v", job3)
	}
}

func TestAdminNotificationService_NotifyErrorSanitization(t *testing.T) {
	svc := &AdminNotificationService{
		adminGroupID: -1001234567890,
		topicSystem:  intPtr(99),
		queue:        make(chan notificationJob, 10),
		stopCh:       make(chan struct{}),
	}

	ctx := context.Background()
	maliciousErr := errors.New("syntax error at <unknown> & unclosed 'tag'")
	svc.NotifyError(ctx, maliciousErr, "Payment<Hook> & Handler")

	if len(svc.queue) != 1 {
		t.Fatalf("expected 1 job in queue, got %d", len(svc.queue))
	}

	job := <-svc.queue
	// Must contain escaped versions, not raw < > &
	if !contains(job.text, "&lt;unknown&gt;") || !contains(job.text, "Payment&lt;Hook&gt; &amp; Handler") {
		t.Fatalf("HTML was not escaped properly: %s", job.text)
	}
}

func TestAdminNotificationService_DisabledWhenNoGroupID(t *testing.T) {
	svc := &AdminNotificationService{
		adminGroupID: 0,
		queue:        make(chan notificationJob, 10),
		stopCh:       make(chan struct{}),
	}

	svc.NotifyAVM(context.Background(), "Should not enqueue")
	if len(svc.queue) != 0 {
		t.Fatalf("expected 0 jobs in queue when adminGroupID is 0, got %d", len(svc.queue))
	}
}

func intPtr(v int) *int {
	return &v
}

func contains(s, substr string) bool {
	return time.Duration(len(s)) > 0 && len(substr) > 0 && stringContains(s, substr)
}

func stringContains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
