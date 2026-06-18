package channelmgmt

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"ifragment-backend/internal/repository"
)

type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleViewer Role = "viewer"
)

// Permission definitions
const (
	PermEditSettings  = "edit_settings"
	PermDeleteChannel = "delete_channel"
	PermViewAnalytics = "view_analytics"
	PermManageFunnels = "manage_funnels"
)

var rolePermissions = map[Role][]string{
	RoleOwner:  {PermEditSettings, PermDeleteChannel, PermViewAnalytics, PermManageFunnels},
	RoleAdmin:  {PermEditSettings, PermViewAnalytics, PermManageFunnels},
	RoleViewer: {PermViewAnalytics},
}

func HasPermission(role Role, perm string) bool {
	perms, ok := rolePermissions[role]
	if !ok {
		return false
	}
	for _, p := range perms {
		if p == perm {
			return true
		}
	}
	return false
}

func (s *ChannelService) GetUserRole(ctx context.Context, userID int64, channelID uuid.UUID) (Role, *repository.ManagedChannel, error) {
	ch, err := s.channelRepo.GetChannelByID(ctx, channelID)
	if err != nil {
		return "", nil, err
	}

	// 1. Check if they are the bot owner
	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err == nil && bot.OwnerUserID == userID {
		return RoleOwner, ch, nil
	}

	// 2. Check channel_admins table
	admins, err := s.channelRepo.GetChannelAdmins(ctx, channelID)
	if err == nil {
		for _, admin := range admins {
			if admin.TelegramID == userID {
				if admin.IsOwner {
					return RoleOwner, ch, nil
				}
				// Require exact case-insensitive match to avoid demoting administrators whose title simply contains "viewer"
				if admin.CustomTitle != nil && strings.ToLower(strings.TrimSpace(*admin.CustomTitle)) == "viewer" {
					return RoleViewer, ch, nil
				}
				return RoleAdmin, ch, nil
			}
		}
	}

	return "", nil, fmt.Errorf("unauthorized")
}

func (s *ChannelService) verifyAccess(ctx context.Context, userID int64, channelID uuid.UUID, allowedRoles ...Role) error {
	role, _, err := s.GetUserRole(ctx, userID, channelID)
	if err != nil {
		return err
	}

	matched := false
	for _, allowed := range allowedRoles {
		if role == allowed {
			matched = true
			break
		}
	}
	if !matched {
		return fmt.Errorf("unauthorized: role %s not allowed", role)
	}

	return nil
}

func (s *ChannelService) verifyPermission(ctx context.Context, userID int64, channelID uuid.UUID, perm string) error {
	role, _, err := s.GetUserRole(ctx, userID, channelID)
	if err != nil {
		return err
	}

	if !HasPermission(role, perm) {
		return fmt.Errorf("unauthorized: role %s lacks permission %s", role, perm)
	}
	return nil
}
