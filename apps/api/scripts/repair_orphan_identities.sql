"""repair orphaned wechat identities (run on VPS via postgres container)

Usage:
  docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres \\
    psql -U ai_todo -d ai_todo -f - <<'SQL'
  DELETE FROM identities i
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = i.user_id);
  SQL
"""

from __future__ import annotations

# Or one-liner for operators:
# DELETE FROM identities i WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = i.user_id);
