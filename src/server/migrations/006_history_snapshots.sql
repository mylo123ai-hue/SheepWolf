ALTER TABLE experiments ADD COLUMN scenario_version TEXT NOT NULL DEFAULT '1';
UPDATE experiments
SET scenario_version = CASE scenario_id
  WHEN 'capture-the-flags' THEN 'flags-1'
  WHEN 'the-investigation' THEN 'archive-1'
  ELSE '1'
END;

ALTER TABLE experiment_participants ADD COLUMN name_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE experiment_participants ADD COLUMN personality_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE experiment_participants ADD COLUMN color_snapshot TEXT NOT NULL DEFAULT '#a9b39f';
ALTER TABLE experiment_participants ADD COLUMN initials_snapshot TEXT NOT NULL DEFAULT '';

UPDATE experiment_participants
SET name_snapshot = (SELECT name FROM characters WHERE id = experiment_participants.character_id),
    personality_snapshot = (SELECT personality FROM characters WHERE id = experiment_participants.character_id),
    color_snapshot = (SELECT color FROM characters WHERE id = experiment_participants.character_id),
    initials_snapshot = (SELECT initials FROM characters WHERE id = experiment_participants.character_id)
WHERE name_snapshot = '';
