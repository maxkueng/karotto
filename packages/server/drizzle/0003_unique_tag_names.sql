-- Merge tags whose names differ only in case, keeping the oldest, before enforcing uniqueness.
CREATE TEMP TABLE tag_dupes AS
SELECT t.id, k.keep
FROM tags t
JOIN (
  SELECT DISTINCT ON (user_id, lower(name)) id AS keep, user_id, lower(name) AS key
  FROM tags
  ORDER BY user_id, lower(name), created_at, id
) k ON k.user_id = t.user_id AND k.key = lower(t.name) AND k.keep <> t.id;
--> statement-breakpoint
INSERT INTO task_tags (task_id, tag_id)
SELECT tt.task_id, d.keep FROM task_tags tt JOIN tag_dupes d ON d.id = tt.tag_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM tags WHERE id IN (SELECT id FROM tag_dupes);
--> statement-breakpoint
DROP TABLE tag_dupes;
--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_idx" ON "tags" USING btree ("user_id",lower("name"));