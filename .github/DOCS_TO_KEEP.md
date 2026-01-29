# 📚 Documentation Files for GitHub

This file is the authority on which documentation to **keep** vs **remove**.  
**DOCS_INDEX.md** lists only files that exist and should be linked; use it as the single index.

---

## ✅ Keep These Files

### Essential (root)
- **README.md** – Main project overview and quick start
- **ADMIN.md** – Admin system documentation
- **SECURITY.md** – Security guidelines

### Database & setup
- **README_SUPABASE.md** – Supabase setup and configuration
- **SUPABASE_STORAGE_SETUP.md** – Storage buckets and policies
- **DB_VERIFICATION_PLAN.md** – Database verification and schema checks

### Testing
- **TESTING_GUIDE.md** – Complete testing (UI, API, requests feed, sessions)
- **QUICK_START_TESTING.md** – Quick testing reference

### Features & planning
- **APP_FEATURES_STATUS.md** – Features, UI screens, implementation status
- **IMPLEMENTATION_PLAN.md** – Implementation roadmap

### Backend
- **backend/README.md** – Backend overview
- **backend/README_SETUP.md** – Backend setup and quick start
- **backend/API_GUIDE.md** – REST API documentation
- **backend/TESTING.md** – Backend testing

### Meta
- **.github/DOCS_INDEX.md** – Documentation index (only existing docs)
- **.github/DOCS_TO_KEEP.md** – This file

---

## ❌ Removed / Redundant (do not re-add)

These were consolidated or replaced; **do not recreate** them.

| Removed | Replaced by |
|--------|-------------|
| TESTING_BABYSITTER_REQUESTS_FEED.md | TESTING_GUIDE.md |
| DATABASE_SETUP_GUIDE.md | README_SUPABASE.md / README.md |
| DATABASE_SETUP_SUMMARY.md | README_SUPABASE.md |
| QUICK_SETUP.md | README.md |
| EXPO_GO_LIMITATIONS.md | README.md / setup docs |
| DATABASE_GUIDE.md | README_SUPABASE.md / DB_VERIFICATION_PLAN.md |
| HYBRID_ARCHITECTURE.md | README / backend docs |
| HOW_TO_CHECK_LOCAL_DB.md | TESTING_GUIDE.md / README |
| DATABASE_SETUP_COMPLETE.md | README_SUPABASE.md |
| LOCAL_DATABASE_GUIDE.md | TESTING_GUIDE.md, README |

---

## 📝 If you find an old reference

- In **code or docs**: point the link to the replacement in the table above.
- In **DOCS_INDEX.md**: remove the entry if the file no longer exists; add new docs here and in DOCS_TO_KEEP “Keep” list.
