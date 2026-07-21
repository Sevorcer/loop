# Sprint 27 Execution Plan

> **Canonical reference for Sprint 27 (PR B): Platform Services Migration**
> Issues: #57 (Storage + GC Issue Requests), #58 (Copilot Search), #59 (Reporting / Company Brain / Project Portal)

---

## Architecture Constraint

All migrations follow the mandatory data access hierarchy:

UI ? Hooks ? Services ? Repositories ? Supabase

No component may call Supabase or Supabase Storage directly.  
No service may bypass a repository.  
No production path may import mock data modules.
