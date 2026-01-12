# Child Instructions Database Schema Update

## Overview
Updated the `child_instructions` table to include all fields from the UI form, enabling proper storage and retrieval for chatbot RAG (Retrieval-Augmented Generation).

## New Columns Added

### Basic Care
- `bedtime` (TEXT) - Child bedtime (e.g., "8:00 PM")
- `dietary_restrictions` (TEXT) - Dietary restrictions (e.g., "No nuts, vegetarian")

### Health & Safety
- `medications` (JSONB) - Array of medication objects: `[{name, dosage, time, notes}]`
  - Changed from `medication` (TEXT) to `medications` (JSONB)
- `allergies` (JSONB) - Array of allergy strings
  - Changed from TEXT to JSONB for better querying

### Preferences
- `favorite_activities` (JSONB) - Array of favorite activity strings
- `comfort_items` (JSONB) - Array of comfort item strings
- `routines` (TEXT) - Daily routines and rituals
- `special_needs` (TEXT) - Special care requirements

### Emergency & Medical
- `doctor_info` (JSONB) - Doctor information object: `{name, phone, clinic}`
- `emergency_contacts` (JSONB) - Already existed, no change

### Additional
- `additional_notes` (TEXT) - Any other important information

## Migration Steps

1. **Run the SQL migration:**
   ```sql
   -- Run scripts/ADD_CHILD_INSTRUCTIONS_COLUMNS.sql in Supabase SQL Editor
   ```

2. **The migration will:**
   - Add all new columns
   - Migrate existing `medication` (TEXT) → `medications` (JSONB)
   - Migrate existing `allergies` (TEXT) → `allergies` (JSONB)
   - Create GIN indexes for JSONB columns (for better chatbot querying)

## Benefits for Chatbot RAG

1. **Structured Data**: Each field is stored separately, making it easier to query specific information
2. **JSONB Arrays**: Arrays are stored as JSONB, enabling efficient array queries
3. **Indexes**: GIN indexes on JSONB columns improve search performance
4. **Complete Data**: All UI fields are now properly stored, not combined into a single text field

## Backward Compatibility

The code handles both old and new formats:
- Old format: `medication` (TEXT), `allergies` (TEXT)
- New format: `medications` (JSONB), `allergies` (JSONB)

The migration script automatically converts old data to the new format.

## Example Queries for Chatbot

```sql
-- Find children with specific allergies
SELECT * FROM child_instructions 
WHERE allergies @> '["Peanuts"]'::jsonb;

-- Find children with specific medications
SELECT * FROM child_instructions 
WHERE medications @> '[{"name": "Epipen"}]'::jsonb;

-- Find children with specific favorite activities
SELECT * FROM child_instructions 
WHERE favorite_activities @> '["Reading"]'::jsonb;

-- Full-text search across all instruction fields
SELECT * FROM child_instructions 
WHERE 
  feeding_schedule ILIKE '%breakfast%' OR
  nap_schedule ILIKE '%afternoon%' OR
  routines ILIKE '%bedtime%' OR
  special_needs ILIKE '%autism%';
```
