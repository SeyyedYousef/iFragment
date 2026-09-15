BEGIN;

INSERT INTO quests (
	key,
	title,
	type,
	reward_frg,
	reward_xp,
	config,
	is_active
)
VALUES (
	'boost_fragment_investors_daily',
	'Boost Fragment Investors',
	'chat_boost_daily',
	5000.0,
	50,
	'{
		"chat_username": "@FragmentInvestors",
		"group_url": "https://t.me/FragmentInvestors",
		"cooldown_hours": 24
	}',
	TRUE
)
ON CONFLICT (key) DO UPDATE SET
	title = EXCLUDED.title,
	type = EXCLUDED.type,
	reward_frg = EXCLUDED.reward_frg,
	reward_xp = EXCLUDED.reward_xp,
	config = EXCLUDED.config,
	is_active = TRUE;

COMMIT;
