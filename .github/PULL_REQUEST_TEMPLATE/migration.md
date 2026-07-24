## Migration PR

<!-- Use this template when your PR contains changes to supabase/migrations/ -->
<!-- Replace every placeholder in angle brackets with the actual value.     -->

### Summary

<!-- One or two sentences: what schema change does this migration make and why? -->

**Migration file(s):**  
`supabase/migrations/<TIMESTAMP>_<description>.sql`

---

### Checklist

- [ ] Migration file follows the naming convention `YYYYMMDDHHMMSS_description.sql`
- [ ] No existing migration files were modified (new files only)
- [ ] Migration was tested against staging before this PR was opened
- [ ] Pre-migration backup confirmed (name: `________________`)
- [ ] RLS policies updated if new tables were added
- [ ] TypeScript types / repositories updated to match schema changes
- [ ] `npm run build` passes locally

---

### Rollback Plan

> **Required.** Fill out the full rollback checklist before requesting review.  
> Template: [`docs/migrations/rollback-checklist.md`](../docs/migrations/rollback-checklist.md)

#### Blast Radius

<!-- Which tables, routes, and user workflows are affected if this migration causes an incident? -->

#### Rollback SQL

```sql
-- Paste the exact revert SQL here (or state "Point-in-Time Restore required — see backup-restore.md")

```

#### Data-Loss Risk

<!-- Can rows or columns be permanently lost? If yes, what is the mitigation? -->

#### Verification After Rollback

<!-- Which commands / checks will confirm the system is stable after rollback? -->

---

### Related

Closes #
