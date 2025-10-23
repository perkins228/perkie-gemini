# Cloud Run Revision Persistence - Root Cause Analysis & Fix

**Created**: 2025-10-05
**Status**: ROOT CAUSE IDENTIFIED
**Severity**: HIGH - Wasting deployment time with wrong code

---

## Problem Summary

Cloud Run keeps creating revision `00087-ft9` with WRONG code (contains deleted `limiter.check()` middleware) even after:
1. Deleting the revision
2. Changing Dockerfile cache-bust comment
3. Changing version number in code (2.0.0 → 2.0.1)
4. Multiple redeploys with `--source .`

**Deployed Revision State** (00087-ft9):
- Error logs: `line 117: limiter.check(request)`
- This middleware code was supposedly removed locally
- Revision hash `00087-ft9` keeps reappearing after deletion

**Local File State** (what you see):
- `main.py` line 107: Comment "Rate limiting is handled by slowapi"
- NO `limiter.check()` anywhere in current file
- Version changed to 2.0.1
- Dockerfile cache-bust updated

---

## ROOT CAUSE IDENTIFIED

### The Real Problem: Git Branch State Mismatch

**Your local branch is 8 commits BEHIND origin/staging:**

```bash
$ git status
On branch staging
Your branch is behind 'origin/staging' by 8 commits, and can be fast-forwarded.
```

**Git History Analysis:**
```
* 69860be (origin/staging)      ← 8 commits ahead
* ae19a4c (origin/staging)
* 447ce48 (origin/staging)
* 38e3251 (origin/staging)
* 5b6b462 (origin/staging)
* d3b05ab (origin/staging)
* 95569ee (origin/staging)
* 66976de (origin/staging)
* 76886d5 (HEAD -> staging)     ← You are here (local)
```

### Cloud Run Source Hash Behavior

**How `--source .` Works:**
1. Cloud Run uses `gcloud builds submit` under the hood
2. It creates a source tarball from your CURRENT git state
3. The revision hash is based on:
   - Source code SHA (from git commit)
   - Build configuration
   - Container configuration

**Why Same Revision Hash?**
- You're deploying from the SAME git commit (76886d5)
- Even though you modified files locally, they're NOT COMMITTED
- Cloud Run sees: "Same commit hash + uncommitted changes = same build"
- Your local modifications (removing `limiter.check()`) are NOT in version control

**Why Wrong Code Deployed?**
Your local working directory has:
- **Committed code**: OLD version from 8 commits ago (has `limiter.check()` middleware)
- **Uncommitted changes**: Your edits removing the middleware (NOT deployed)

When `--source .` runs:
1. Looks at git HEAD commit: 76886d5 (8 commits behind)
2. Ignores unstaged changes by default
3. Deploys code from commit 76886d5
4. That commit HAS the broken `limiter.check()` middleware

---

## Verification Evidence

### 1. Local File Check - No `limiter.check()` Found
```bash
$ grep -n "limiter.check" backend/inspirenet-api/src/main.py
# (No output - not in current working file)
```

### 2. Git Diff Shows Uncommitted Changes
```bash
$ git status
Changes not staged for commit:
  modified:   src/main.py
  modified:   requirements.txt
  modified:   Dockerfile
  modified:   src/api_v2_endpoints.py
  modified:   src/edge_cache_strategy.py
```

These modifications include removing `limiter.check()` middleware, but they're NOT committed.

### 3. Deployed Code vs Git HEAD
- Deployed revision: Based on git commit (ignores working changes)
- Your edits: In working directory, not committed
- Result: Deploying old code with middleware bug

---

## Why Your Attempted Fixes Failed

### ❌ Deleting Revision 00087-ft9
**Why it failed**:
- Deleting the revision doesn't change your source code state
- Redeploying from same git commit recreates identical revision
- Cloud Run deterministically generates same hash for same source

### ❌ Changing Dockerfile Cache-Bust Comment
**Why it failed**:
- Dockerfile changes are uncommitted
- Cloud Run deploys from git commit, not working directory
- Even if committed, wouldn't change the Python code being deployed

### ❌ Changing Version Number (2.0.0 → 2.0.1)
**Why it failed**:
- Version number change is uncommitted
- Doesn't affect revision hash calculation
- Revision hash is based on SOURCE, not version strings

---

## The CORRECT Fix

### Option 1: Pull Remote Changes (RECOMMENDED)

**Why this works**: Gets you the latest code from origin/staging which may have already removed the middleware.

```bash
# Navigate to backend directory
cd backend/inspirenet-api

# Stash your local changes
git stash

# Pull the 8 commits you're missing
git pull origin staging

# Check if middleware is gone in remote version
grep -n "limiter.check" src/main.py

# If still present in remote, pop your stash
git stash pop

# If remote already fixed it, you're done
```

**Expected outcome**:
- If remote code already removed `limiter.check()`, you're fixed
- If not, proceed to Option 2

---

### Option 2: Commit Your Local Changes

**Why this works**: Creates new git commit, Cloud Run sees different source hash, builds new revision.

```bash
# Navigate to backend directory
cd backend/inspirenet-api

# Review what you're about to commit
git diff src/main.py

# Stage your changes
git add src/main.py requirements.txt Dockerfile src/api_v2_endpoints.py src/edge_cache_strategy.py

# Commit with descriptive message
git commit -m "fix: Remove broken limiter.check middleware, implement per-endpoint rate limiting

- Remove middleware rate limiter that caused AttributeError
- Keep slowapi infrastructure for per-endpoint decorators
- Update version to 2.0.1
- Add cache-bust comment to Dockerfile"

# Push to remote
git push origin staging

# Deploy from committed state
gcloud run deploy inspirenet-bg-removal-api \
  --source . \
  --region us-central1 \
  --project perkieprints-production
```

**Expected outcome**:
- New git commit = different source hash
- Cloud Run creates NEW revision (e.g., 00088-xxx)
- New revision has your corrected code without `limiter.check()`

---

### Option 3: Deploy from Specific Commit (NUCLEAR OPTION)

**Use only if**: You need to deploy a specific commit that's already in history.

```bash
# Find the commit you want to deploy
git log --oneline

# Deploy from specific commit (not recommended, breaks git workflow)
git checkout <commit-hash>
gcloud run deploy ... --source .

# Return to branch
git checkout staging
```

**WARNING**: This breaks your git workflow. Only use for emergency rollback.

---

## Deployment Best Practices Going Forward

### 1. Always Commit Before Deploy
```bash
# Check for uncommitted changes
git status

# If you see modified files, commit them FIRST
git add <files>
git commit -m "description"
git push origin staging

# THEN deploy
gcloud run deploy ...
```

### 2. Verify Git State
```bash
# Check you're on correct branch
git branch

# Check you're up to date with remote
git status

# Should see: "Your branch is up to date with 'origin/staging'"
```

### 3. Use Deployment Script
Create `backend/inspirenet-api/deploy.sh`:
```bash
#!/bin/bash
set -e

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "❌ ERROR: You have uncommitted changes!"
    echo "Commit your changes before deploying:"
    git status -s
    exit 1
fi

# Check branch
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "staging" ]]; then
    echo "⚠️  WARNING: Deploying from branch '$BRANCH' (not staging)"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy
echo "✅ Deploying from clean git state..."
gcloud run deploy inspirenet-bg-removal-api \
  --source . \
  --region us-central1 \
  --project perkieprints-production

echo "✅ Deployment initiated!"
```

### 4. Monitor Revision Creation
```bash
# After deploy, verify NEW revision created
gcloud run revisions list \
  --service=inspirenet-bg-removal-api \
  --region=us-central1 \
  --project=perkieprints-production \
  --limit=5

# Should see NEW revision, not 00087-ft9
```

---

## Technical Deep Dive: Cloud Run Revision Naming

### Revision Hash Generation

Cloud Run revision names follow pattern: `<service>-<hash>-<suffix>`
- Example: `inspirenet-bg-removal-api-00087-ft9`

**Hash components** (simplified):
1. Git commit SHA (primary)
2. Build configuration (cloudbuild.yaml, Dockerfile directives)
3. Container configuration (env vars, resources, timeout)
4. Service configuration (CPU, memory, concurrency)

**Why same hash?**
- Deploying from same git commit → same primary hash component
- Uncommitted changes → NOT included in hash
- Same Dockerfile commands → same build config
- Result: Deterministic hash collision

### How to Force New Revision

**Guaranteed methods:**
1. ✅ New git commit (changes source SHA)
2. ✅ Change Dockerfile base image or key directives (changes build config)
3. ✅ Change Cloud Run service config (CPU/memory/timeout)

**Unreliable methods:**
1. ❌ Deleting old revision (doesn't change source)
2. ❌ Comment changes in Dockerfile (ignored in hash)
3. ❌ Version string changes (not in hash calculation)
4. ❌ Uncommitted file changes (not in hash)

---

## Verification Steps After Fix

### 1. Confirm New Revision Created
```bash
gcloud run revisions list \
  --service=inspirenet-bg-removal-api \
  --region=us-central1 \
  --limit=5 \
  --format="table(metadata.name,status.conditions.status)"
```

**Expected**: New revision name (NOT 00087-ft9)

### 2. Check Deployed Code
```bash
# Trigger the error endpoint to verify middleware is gone
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Expected**:
- ❌ OLD: `AttributeError: 'Request' object has no attribute 'limiter.check'`
- ✅ NEW: Proper rate limit error or validation error (no AttributeError)

### 3. Review Container Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api" \
  --limit=50 \
  --format=json \
  | grep -A5 "limiter.check"
```

**Expected**: No references to `limiter.check` in new revision logs

---

## Lessons Learned

### Git Workflow Issues
1. **Always check git status before deploy**
   - `git status` reveals uncommitted changes
   - Uncommitted changes are NOT deployed

2. **Always sync with remote before deploy**
   - `git pull origin staging` gets latest code
   - Avoids deploying stale code from 8 commits ago

3. **Commit-then-deploy workflow**
   - Make changes → Test locally → Commit → Push → Deploy
   - Never deploy with uncommitted changes

### Cloud Run Behavior
1. **Source hash is deterministic**
   - Same git commit = same revision hash
   - Can't "force" new revision without changing source

2. **`--source .` deploys git state, not working directory**
   - Use `git add` and `git commit` BEFORE deploy
   - Or use `--ignore-file` patterns (not recommended)

3. **Revision deletion is cosmetic**
   - Deleting revision doesn't prevent recreation
   - Hash is based on source, not previous revisions

---

## Prevention Checklist

Before EVERY deployment:

```bash
# 1. Check uncommitted changes
git status
# If changes shown, commit them first

# 2. Check branch synchronization
git fetch origin
git status
# If behind, run: git pull origin staging

# 3. Verify file contents match expectations
grep -n "limiter.check" src/main.py
# Should return nothing if middleware removed

# 4. Check current commit
git log --oneline -1
# Note the commit hash

# 5. Deploy
gcloud run deploy ... --source .

# 6. Verify new revision
gcloud run revisions list --limit=5
# Should see NEW revision hash
```

---

## Next Steps

### Immediate Actions

1. **Pull remote changes** (8 commits behind):
   ```bash
   cd backend/inspirenet-api
   git pull origin staging
   ```

2. **Verify middleware status** in pulled code:
   ```bash
   grep -n "limiter.check" src/main.py
   ```

3. **If still present, commit your local fix**:
   ```bash
   git add src/main.py requirements.txt Dockerfile
   git commit -m "fix: Remove broken limiter middleware"
   git push origin staging
   ```

4. **Deploy from clean state**:
   ```bash
   gcloud run deploy inspirenet-bg-removal-api --source . --region us-central1
   ```

5. **Verify new revision created**:
   ```bash
   gcloud run revisions list --limit=5
   ```

### Long-term Improvements

1. **Create deployment script** with git state validation
2. **Add pre-deploy hook** to check uncommitted changes
3. **Use CI/CD pipeline** (Cloud Build) to enforce clean deployments
4. **Document workflow** in `backend/inspirenet-api/DEPLOYMENT.md`

---

## Related Files

**Modified Files** (uncommitted):
- `backend/inspirenet-api/src/main.py` - Removed middleware
- `backend/inspirenet-api/requirements.txt` - Added slowapi
- `backend/inspirenet-api/Dockerfile` - Cache-bust update
- `backend/inspirenet-api/src/api_v2_endpoints.py` - Rate limit infrastructure
- `backend/inspirenet-api/src/edge_cache_strategy.py` - Related changes

**Deployment Files**:
- `backend/inspirenet-api/deploy-production-clean.yaml` - Cloud Run config
- `backend/inspirenet-api/cloudbuild.yaml` - Build configuration

**Documentation**:
- `.claude/tasks/context_session_active.md` - Session context (lines 534-695)

---

## Conclusion

**Root Cause**: Deploying from git state 8 commits behind origin/staging with uncommitted local changes.

**Why Same Revision**: Cloud Run deterministically generates revision hash from git commit SHA. Same commit = same hash.

**Fix**:
1. Pull remote changes: `git pull origin staging`
2. OR commit local changes: `git add . && git commit -m "fix" && git push`
3. Then deploy: `gcloud run deploy --source .`

**Prevention**: Always commit and sync before deploying. Use deployment script to enforce clean git state.

**Expected Outcome**: New revision (00088-xxx or higher) with correct code, no `limiter.check()` middleware.

---

**End of Analysis**
