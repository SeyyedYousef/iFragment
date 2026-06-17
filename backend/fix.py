import os
import re

def fix_webhook(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. GetGroupByChatID -> GetGroup
    content = re.sub(r'GetGroupByChatID\(ctx, (msg\.Chat\.ID|chat\.ID|chatID|m\.Chat\.ID|cq\.Message\.Chat\.ID|mc\.ChatID)\)',
                     r'GetGroup(ctx, bot.ID, \1)', content)
    
    # 2. executeViolationAction
    content = re.sub(r'executeViolationAction\(ctx, (msg\.Chat\.ID|m\.Chat\.ID|chatID), (.*?), (.*?), (.*?), (.*?)\)',
                     r'executeViolationAction(ctx, bot, \1, \2, \3, \4, \5)', content)
    content = re.sub(r'func \(h \*WebhookHandler\) executeViolationAction\(ctx context.Context, chatID int64',
                     r'func (h *WebhookHandler) executeViolationAction(ctx context.Context, bot *repository.ManagedBot, chatID int64', content)
    # Remove GetBotByChatID from executeViolationAction
    content = re.sub(r'(\s*bot, err := h\.botRepo\.GetBotByChatID.*?if err != nil {\s*return\s*})', '', content, flags=re.DOTALL)
    
    # 3. deleteMessage
    content = re.sub(r'deleteMessage\(ctx, (msg\.Chat\.ID|m\.Chat\.ID|chat\.ID|chatID), (.*?)\)',
                     r'deleteMessage(ctx, bot, \1, \2)', content)
    content = re.sub(r'func \(h \*WebhookHandler\) deleteMessage\(ctx context\.Context, chatID int64',
                     r'func (h *WebhookHandler) deleteMessage(ctx context.Context, bot *repository.ManagedBot, chatID int64', content)
    # Remove GetBotByChatID from deleteMessage
    content = re.sub(r'(\s*bot, err := h\.botRepo\.GetBotByChatID.*?if err != nil {\s*return\s*})', '', content, flags=re.DOTALL)

    # 4. ValidateMessage
    content = re.sub(r'h\.moderator\.ValidateMessage\(ctx, mc\)', r'h.moderator.ValidateMessage(ctx, bot, mc)', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def fix_moderator(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # ValidateMessage signature
    content = re.sub(r'func \(s \*ModeratorService\) ValidateMessage\(ctx context\.Context, mc \*MessageContext\) \(\*Violation, error\) {',
                     r'func (s *ModeratorService) ValidateMessage(ctx context.Context, bot *repository.ManagedBot, mc *MessageContext) (*Violation, error) {', content)
    
    # Inside ValidateMessage
    content = re.sub(r'group, err := s\.botRepo\.GetGroupByChatID\(ctx, mc\.ChatID\)', r'group, err := s.botRepo.GetGroup(ctx, bot.ID, mc.ChatID)', content)
    content = re.sub(r'\s*bot, err := s\.botRepo\.GetBotByID.*?if err != nil {\s*return nil, err\s*}', '', content, flags=re.DOTALL)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_webhook('./internal/handler/webhook.go')
fix_moderator('./internal/service/botmgmt/moderator_service.go')

print("Done")
