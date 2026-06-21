import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. Remove frgRepo from structs and function signatures
    content = re.sub(r'frgRepo\s+\*repository\.FRGRepo\s*,?\s*', '', content)
    content = re.sub(r',\s*frgRepo\s+\*repository\.FRGRepo', '', content)
    
    # 2. Replace frgRepo initializations
    content = re.sub(r'frgRepo:\s*repository\.NewFRGRepo\(db\),?\s*\n', '', content)
    content = re.sub(r'frgRepo:\s*frgRepo,?\s*\n', '', content)

    # 3. Replace RewardFrg -> RewardCoins
    content = content.replace('RewardFrg', 'RewardCoins')
    content = content.replace('FrgReward', 'RewardCoins')

    # 4. Replace tx, err := s.frgRepo.DB().Pool.Begin(ctx) -> s.db.Pool.Begin(ctx) or s.repo.DB().Pool.Begin
    # depending on the service.
    content = content.replace('s.frgRepo.DB().Pool.Begin(ctx)', 's.repo.DB().Pool.Begin(ctx)')
    
    # In gamification_service, it's s.db.Pool.Begin, but owner_service is s.repo.DB()
    # Let's be careful.
    
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('backend/internal'):
    for file in files:
        if file.endswith('.go'):
            process_file(os.path.join(root, file))
