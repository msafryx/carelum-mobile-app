# Child Instructions Database Migration Guide

## Current Issue
The error "Could not find the 'medication' column" indicates that:
- Either the migration was run and `medication` was dropped, but code still references it
- OR the migration hasn't been run yet, and the code is using `medications` which doesn't exist

## Solution

### Step 1: Run the Migration SQL
1. Open Supabase SQL Editor
2. Run `scripts/ADD_CHILD_INSTRUCTIONS_COLUMNS.sql`
3. This will:
   - Add all new columns (`bedtime`, `dietary_restrictions`, `medications`, `favorite_activities`, etc.)
   - Migrate data from `medication` (TEXT) → `medications` (JSONB)
   - Migrate data from `allergies` (TEXT) → `allergies` (JSONB)
   - **Keep both old and new columns temporarily** (for backward compatibility)

### Step 2: Verify the Migration
After running the migration, check that:
- New columns exist: `medications`, `bedtime`, `dietary_restrictions`, etc.
- Old `medication` column still exists (it will be dropped later)
- Data was migrated correctly

### Step 3: Test the App
1. Try saving instructions - should work now
2. All fields should save to their respective columns
3. Instructions should load correctly

### Step 4: (Optional) Clean Up
After verifying everything works, you can drop the old `medication` column:
```sql
ALTER TABLE child_instructions DROP COLUMN IF EXISTS medication;
```

## New Columns Added

| Column Name | Type | Description |
|------------|------|-------------|
| `bedtime` | TEXT | Child bedtime (e.g., "8:00 PM") |
| `dietary_restrictions` | TEXT | Dietary restrictions |
| `medications` | JSONB | Array of medication objects |
| `allergies` | JSONB | Array of allergy strings |
| `favorite_activities` | JSONB | Array of favorite activities |
| `comfort_items` | JSONB | Array of comfort items |
| `routines` | TEXT | Daily routines |
| `special_needs` | TEXT | Special care requirements |
| `doctor_info` | JSONB | Doctor information object |
| `additional_notes` | TEXT | Additional notes |

## Code Updates
The code has been updated to:
- ✅ Use `medications` (not `medication`) when saving
- ✅ Handle both `medications` and `medication` when reading (backward compatibility)
- ✅ Save all fields to their respective columns
- ✅ Load all fields from their respective columns

## Troubleshooting

### Error: "Could not find the 'medication' column"
**Solution:** Run the migration SQL to add the `medications` column. The code now uses `medications` (JSONB), not `medication` (TEXT).

### Error: "Could not find the 'medications' column"
**Solution:** The migration hasn't been run yet. Run `scripts/ADD_CHILD_INSTRUCTIONS_COLUMNS.sql` in Supabase SQL Editor.

### Data not saving
**Solution:** 
1. Verify the migration was run successfully
2. Check that all new columns exist in the database
3. Check the console for any errors
