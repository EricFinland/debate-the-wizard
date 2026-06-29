ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_difficulty_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_difficulty_check CHECK (difficulty IN ('novice','adept','archmage','impossible'));
