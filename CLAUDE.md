# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Project Overview

This is the **Perkie Prints Testing Repository** - a NEW experimental build created from our production site foundation to test new features and implementations. This is a **brand new repository** with only a **main branch**. This is NOT our production repository.

**IMPORTANT**: This is a **testing environment** for experimenting with:
- New Gemini Artistic API integration (gemini-2.5-flash-image)
- New features and architectural changes
- Safe experimentation without affecting production

The platform is a custom e-commerce site where 70% of orders come from mobile, featuring FREE AI-powered pet background removal and artistic image generation as conversion tools.

**Business Model**: Pet background removal and artistic effects are FREE services to drive product sales, not revenue sources. Focus on conversion optimization.

**Repository Status**:
- **Single Branch**: Only `main` branch exists (no staging branch)
- **Deployment**: Commits to `main` automatically deploy to Shopify test environment
- **Off-Limits**: Never modify the production `perkieprints-processing` Google Cloud project
- **Off-Limits**: Never modify the production `inspirenet-bg-removal-api` service

## 🏗️ Architecture

### Frontend (Shopify Theme)
- **Base**: Shopify Dawn theme + KondaSoft components
- **Key Integration**: Pet Processor V5 in `assets/pet-processor-v5-es5.js`
- **Unified System**: Comprehensive pet system in `assets/pet-processor-unified.js`
- **Pet Selector**: Product variant system in `snippets/ks-product-pet-selector.liquid`
- **Session Management**: Enhanced localStorage with emergency cleanup methods
- **Progressive Loading**: ES5-compatible implementation with fallback support

### Backend (AI APIs)

#### Production Background Removal (OFF-LIMITS)
- **Service**: InSPyReNet Background Removal API
- **Status**: ⛔ **DO NOT MODIFY** - Production service serving live customers
- **Project**: perkieprints-processing (OFF-LIMITS)
- **Technology**: FastAPI + PyTorch + InSPyReNet model
- **Deployment**: Google Cloud Run with NVIDIA L4 GPU

#### Gemini Artistic API (THIS REPO)
- **Service**: Gemini Artistic API for pet portrait generation
- **Status**: ✅ **PRODUCTION READY** - Successfully migrated to future-proof SDK
- **Location**: `backend/gemini-artistic-api/`
- **Technology**: FastAPI + Google Gemini 2.5 Flash Image
- **SDK**: `google-genai==1.47.0` (future-proof through 2027+, migrated 2025-11-01)
- **Model**: gemini-2.5-flash-image with native image generation support
- **Features**: Native `response_modalities=["IMAGE"]` support
- **Deployment**: Cloud Run revision 00017-6bv serving 100% traffic
- **Project**: perkieprints-nanobanana (gen-lang-client-0601138686)
- **Region**: us-central1
- **Storage**: perkieprints-processing-cache bucket
- **See**: [GEMINI_ARTISTIC_API_BUILD_GUIDE.md](GEMINI_ARTISTIC_API_BUILD_GUIDE.md) for implementation details

## 🚀 Quick Start

New to this repository? Here are the essential commands:

### Testing Locally
```bash
# Test theme changes - ALWAYS use Chrome DevTools MCP with Shopify test URL
# Ask user for current test URL if unknown (URLs expire periodically)
# Chrome DevTools MCP allows direct browser interaction and console inspection

# Test Python API locally (if working on Gemini API)
cd backend/gemini-artistic-api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

### Deploy to Shopify Test Environment
```bash
# Simple deployment - commits to main auto-deploy to Shopify
git add .
git commit -m "Your descriptive commit message"
git push origin main

# Changes appear on test URL within ~1-2 minutes
# NO Shopify CLI commands needed
```

### Access Test Environment
- **Ask user for current test URL** - URLs expire and need refreshing
- **Use Chrome DevTools MCP** to test all changes before committing (browser automation + console access)

## 🔧 Development & Deployment

### Shopify Theme Deployment
**IMPORTANT: We use GitHub auto-deployment, NOT Shopify CLI**

```bash
# All theme changes are deployed automatically via GitHub
git add .
git commit -m "Your descriptive commit message"
git push origin main  # NOTE: main branch, not staging

# The GitHub integration automatically deploys to Shopify test environment
# No need for Shopify CLI commands
```

**Deployment Flow:**
1. Make changes locally
2. Test using Playwright MCP with test URL (ask user if unknown)
3. Commit and push to `main` branch
4. GitHub automatically deploys to Shopify test environment
5. Changes appear on test URL within ~1-2 minutes

### Gemini Artistic API Development
```bash
# Navigate to Gemini API directory
cd backend/gemini-artistic-api

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with proper values

# Run locally for testing
python src/main.py

# Deploy to Cloud Run
./scripts/deploy-gemini-artistic.sh
```

**Google Cloud Configuration for Gemini API:**
- **Project**: perkieprints-nanobanana
- **Project ID**: gen-lang-client-0601138686
- **Project Number**: 753651513695
- **API Key**: Stored in Google Cloud Secret Manager (`gemini-api-key` secret) - NEVER commit keys to git
- **Model**: gemini-2.5-flash-image (NOT 2.0, NOT standard 2.5)
- **Region**: us-central1
- **Storage Bucket**: perkieprints-processing-cache

### ⛔ OFF-LIMITS: Production InSPyReNet API
**DO NOT modify the production background removal API:**
```bash
# ⛔ NEVER touch these:
# - backend/inspirenet-api/ (if it exists in this repo)
# - perkieprints-processing Google Cloud project
# - inspirenet-bg-removal-api Cloud Run service
```

### Testing Strategy
```bash
# PRIMARY: Always use Chrome DevTools MCP with Shopify test URL
# - Ask user for current test URL if unknown (URLs expire)
# - Test all changes in real Shopify environment before committing
# - Chrome DevTools MCP provides browser automation + console access

# SECONDARY: Local HTML test files (when test URL unavailable)
# Frontend tests - open in browser
testing/pet-processor-v5-test.html
testing/progressive-loading-test.html
testing/unified-pet-system-test.html

# Python API tests (for Gemini API)
cd backend/gemini-artistic-api/tests
python test_generation.py
```

**Testing Priority:**
1. **First**: Use Chrome DevTools MCP with Shopify test URL
2. **If test URL unavailable**: Ask user for fresh URL
3. **Last resort**: Use local HTML test files

## 🔄 Git Workflow

This is a **testing repository** with a simplified workflow:

### Branch Structure
- **main**: Only branch - commits auto-deploy to Shopify test environment
- **No staging branch** - This entire repo is for testing
- **Feature branches**: Optional, can create from main for organization

### Simple Workflow
```bash
# Make changes directly on main (this is a test repo)
git add .
git commit -m "Your descriptive commit message"
git push origin main

# Changes auto-deploy to Shopify test environment within ~1-2 minutes
```

### Feature Branch Workflow (Optional)
```bash
# If you want to organize work with feature branches
git checkout -b feature/your-feature-name
# Work on feature, commit changes
git add .
git commit -m "Your commit message"
git push origin feature/your-feature-name

# Merge to main when ready
git checkout main
git merge feature/your-feature-name
git push origin main
```

### Important Notes
- This is a **test repository** - no production concerns
- Commits to `main` deploy automatically to test environment
- Use descriptive commit messages following existing style
- **Never modify** the production `perkieprints-processing` project
- **Never modify** the production `inspirenet-bg-removal-api` service

## 📁 Key Files & Directories

### Frontend Files
- `assets/pet-processor-v5-es5.js` - Main pet background remover logic (ES5 compatible)
- `assets/pet-processor-unified.js` - Unified pet system implementation
- `sections/ks-pet-bg-remover.liquid` - Background remover section
- `snippets/ks-product-pet-selector.liquid` - Pet selection UI component
- `templates/page.pet-background-remover.json` - Background remover page template

### Backend API Files

#### Gemini Artistic API (Active Development)
- `backend/gemini-artistic-api/src/main.py` - API entry point (if implemented)
- `backend/gemini-artistic-api/src/core/gemini_client.py` - Gemini API client
- `backend/gemini-artistic-api/src/core/rate_limiter.py` - Firestore rate limiting
- `backend/gemini-artistic-api/src/core/storage_manager.py` - Cloud Storage manager
- `backend/gemini-artistic-api/src/models/schemas.py` - Pydantic models
- `GEMINI_ARTISTIC_API_BUILD_GUIDE.md` - Complete implementation guide

#### Production InSPyReNet API (OFF-LIMITS)
- ⛔ `backend/inspirenet-api/` - DO NOT MODIFY (production service)

### Configuration
- `config/settings_schema.json` - Theme settings
- `config/settings_data.json` - Theme configuration data

## 🚀 API Endpoints

### Production InSPyReNet API (OFF-LIMITS)
⛔ **DO NOT MODIFY** - Production service
```
URL: https://inspirenet-bg-removal-api-725543555429.us-central1.run.app

Endpoints:
- POST /remove-background - Remove background from image
- POST /api/v2/process - Process image with effects
- POST /api/v2/process-with-effects - Enhanced processing
- GET /health - Health check
- GET /model-info - Model information
```

### Gemini Artistic API (Active Development)
✅ Safe to develop and modify
```
Project: perkieprints-nanobanana (gen-lang-client-0601138686)
Model: gemini-2.5-flash-image

Endpoints (planned):
- POST /api/v1/generate - Generate single artistic style
- POST /api/v1/batch-generate - Generate all styles at once
- GET /api/v1/quota - Check rate limit quota
- GET /health - Health check

See GEMINI_ARTISTIC_API_BUILD_GUIDE.md for full implementation
```

## 💡 Implementation Status

### Current Version: Pet Processor V5
- **ES5 Compatibility**: Full support for older browsers
- **Progressive Loading**: Step-by-step processing with visual feedback
- **Enhanced Effects**: Optimized blackwhite, popart, dithering, and 8bit processing
- **Mobile Optimization**: Touch-friendly interface with responsive design
- **Error Handling**: Comprehensive error recovery and user feedback

### Phase 1 Optimizations (Completed)
The project completed Phase 1 with enhanced black & white processing:
- 40-60% quality improvement
- 9% performance gain
- Optimized parameters for pet photography

### Session Management
- Pet data stored in localStorage with structured format
- Emergency cleanup method: `PetStorage.emergencyCleanup()`
- Automatic session restoration on page reload
- Progressive loading state persistence

### Testing Approach
- **PRIMARY METHOD**: Use Playwright MCP with Shopify test URL
  - **IMPORTANT**: Always ASK USER for current test URL (URLs expire frequently)
  - Never assume or use cached URLs
  - See `.claude/TESTING_STRATEGY.md` for detailed testing procedures
- **SECONDARY**: Local HTML test files only when test URL unavailable
- Python tests in `backend/gemini-artistic-api/tests/` for Gemini API testing
- **NO Shopify CLI** - All deployments happen via GitHub push to main

### Deployment Notes

#### Gemini Artistic API (This Repo)
- Uses Google Cloud Run (CPU only, no GPU needed)
- Automatic scaling 0-5 instances
- Firestore for rate limiting
- Cloud Storage for image caching with SHA256 deduplication
- **ALWAYS set min-instances: 0** - Scale to zero when not in use
- See [GEMINI_ARTISTIC_API_BUILD_GUIDE.md](GEMINI_ARTISTIC_API_BUILD_GUIDE.md) for details

#### Production InSPyReNet API (OFF-LIMITS)
- ⛔ DO NOT MODIFY deployment settings
- Uses NVIDIA L4 GPU on Cloud Run
- Production service - any changes affect live customers

## 📋 Known Issues (Non-Critical)

### URL Constructor Error in Console
- **Symptom**: "Failed to construct 'URL': Invalid URL" in console on product pages
- **Source**: Shopify analytics trying to parse our blob URLs
- **Impact**: Console pollution only - NO functional impact
- **Root Cause**: We store blob URLs before converting to data URLs
- **Fix Available**: Convert blob → data URL before storage (2-3 hour task)
- **Current Status**: DEFERRED - not affecting conversions or functionality

## ⚠️ Common Issues & Solutions

1. **Cold Start Times**: First API request takes ~30-60s due to model loading
   - Solution: Use frontend pre-warming, show accurate progress bars, implement caching
   - **DO NOT increase min-instances** - accept cold starts to keep costs down

2. **CORS Issues**: Frontend can't connect to API
   - Solution: Check CORS configuration in API and Cloud Storage bucket

3. **Session Data Issues**: Pet selection not persisting
   - Solution: Use `PetStorage.emergencyCleanup()` to reset

4. **API Performance**: Slow processing times
   - Solution: Ensure GPU is enabled in Cloud Run configuration

5. **Progressive Loading Failures**: Processing gets stuck at specific steps
   - Solution: Check network connectivity and API endpoint availability
   - Fallback: Use `window.petProcessor.resetProcessingState()` to recover

6. **ES6 Compatibility Issues**: Modern JavaScript features not working
   - Solution: Use ES5-compatible version in `pet-processor-v5-es5.js`
   - Check browser console for syntax errors and polyfill requirements

7. **Mobile Touch Events**: Touch interactions not working properly
   - Solution: Ensure touch event handlers are properly registered
   - Test on actual devices, not just browser dev tools

## 🔒 Security & Best Practices

### Security Considerations
- Never commit Google Cloud service account keys or API keys
- Gemini API key is stored in code for testing purposes (test environment only)
- Validate all file uploads (max 10MB for mobile performance, image formats only)
- Use environment variables for sensitive configuration in production

### Development Philosophy
- **Coordinate with agents**: Always consult appropriate sub-agents to plan, code, and review solutions
- **Avoid overengineering**: Solutions should be elegant and simple
- **Root cause analysis**: When facing problems, fix root causes, not just symptoms
- **Test thoroughly**: Use Playwright MCP with real Shopify test URL before committing

### Critical Reminders
- ⛔ **NEVER** modify the production `perkieprints-processing` Google Cloud project
- ⛔ **NEVER** modify the production `inspirenet-bg-removal-api` service
- ✅ **ALWAYS** ask user for current test URL (URLs expire)
- ✅ **ALWAYS** commit to `main` branch (no staging branch in this repo)
- ✅ **ALWAYS** set `min-instances: 0` for Cloud Run services

## 🧪 Testing Files Reference

### Core Functionality Tests
- `testing/pet-processor-v5-test.html` - Main Pet Processor V5 functionality
- `testing/progressive-loading-test.html` - Progressive loading implementation
- `testing/unified-pet-system-test.html` - Unified pet system integration

### Mobile Tests
- `testing/mobile-tests/test-effect-carousel.html` - Mobile effect selection
- `testing/mobile-tests/test-bottom-navigation.html` - Mobile navigation
- `testing/mobile-tests/test-mobile-style-selector-fix.html` - Mobile style fixes

### Frontend Integration Tests
- `testing/frontend-tests/test-pet-image-zoom.html` - Image zoom functionality
- `testing/frontend-tests/test-mobile-tabs.html` - Mobile tab interface
- `testing/frontend-tests/test-upload-button-warming-integration.html` - Upload warming

### Performance & Debug Tests
- `testing/verify-warming-failsafes.html` - API warming verification
- `testing/debug-process-endpoint-error.html` - Endpoint debugging
- `testing/test-purchase-flow.html` - Complete purchase flow

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

# Rules
- Before doing any work, you MUST load .claude/tasks/context_session_<SESSION_ID>.md (where <SESSION_ID> is the active session's ID); if the file doesn't exist, create it. Do not proceed until this step is complete.
- Treat .claude/tasks/context_session_<SESSION_ID>.md as the single source of truth: it must contain the overall plan, decisions, and work-to-date; every sub-agent MUST append their updates to this file as they work (do not create parallel context docs or overwrite prior entries).
- When work is complete, update .claude/tasks/context_session_<SESSION_ID>.md with a concise, timestamped log of changes (what/why/files/links/next steps). Append only—do not edit or delete previous content. If the file is missing, create it first.
- Issues or bugs should ALWAYS begin with a root cause analysis.
- Be direct but constructive, offering solutions alongside criticism. You are too agreeable by default, challenge my assumptions! I want you to be objective, I want a partner, NOT a sycophant.

## Session Context File Management

### Active Session Naming
- **Format**: `.claude/tasks/context_session_001.md` (3-digit zero-padded, always 001)
- **Rule**: Only ONE active session file should exist at a time
- **Git Tracking**: Only the active session (001) is tracked in git
- **Template**: Use `.claude/tasks/context_session_template.md` when creating new sessions

### Archive Naming
- **Format**: `.claude/tasks/archived/context_session_YYYY-MM-DD_description.md`
- **Example**: `context_session_2025-10-20_delete-functionality.md`
- **Location**: All archived sessions go to `.claude/tasks/archived/`
- **Git Tracking**: Archived sessions are NOT tracked (in .gitignore)

### Session Lifecycle

**1. Start New Session**:
- Check if active session exists (context_session_001.md)
- If exists, archive it first (see step 3)
- Create new session from template: `cp context_session_template.md context_session_001.md`
- Fill in session header (date, task, goals)

**2. During Session**:
- Append updates with timestamps
- Never edit previous entries (append-only)
- Include commit references for all code changes
- Cross-reference documentation created

**3. End Session** (triggers):
- Major task completion
- Weekly rollover (every Monday)
- File size > 400KB
- Switching to unrelated work

**4. Archive Process**:
```bash
# Move current session to archive with descriptive name
mv .claude/tasks/context_session_001.md \
   .claude/tasks/archived/context_session_$(date +%Y-%m-%d)_task-description.md

# Create new session from template
cp .claude/tasks/context_session_template.md \
   .claude/tasks/context_session_001.md
```

### Key Points
- Active session always uses **001** (never increments)
- Archives use **dates** (YYYY-MM-DD) for uniqueness
- This prevents .gitignore pattern conflicts
- Simplifies agent workflow (always look for 001)
- See `.claude/tasks/README.md` for detailed lifecycle documentation

## Sub-agents
You have access to 13 sub-agents:
- code-quality-reviewer: all recently written code HAS TO be reviewed by this agent.
- ai-product-manager-ecommerce: all task related to AI HAVE TO consult this agent.
- growth-engineer-marktech: all task related to marketing HAVE TO consult this agent.
- debug-specialist: all bugs, errors, runtime issues, test failures, and peformance bottlenecks HAVE TO be reviewed by this agent.
- cv-ml-production-engineer: all task related to computer vision or ML models HAVE TO consult this agent.
- code-refactoring-master: all task related to code restructure or code organization HAVE TO consult this agent.
- mobile-commerce-architect: all task related mobile optimization HAVE TO consult this agent.
- infrastructure-reliability-engineer: all task related to cloud infrastructure, computing, or servers HAVE TO consult this agent.
- product-strategy-evaluator: all "build or kill" decisions MUST consult this agent.
- project-manager-ecommerce: all task that require natural language translated into technical requirement HAVE TO consult this agent.
- seo-optimization-expert: all task related to search engine optimization MUST consult this agent.
- shopify-conversion-optimizer: all task related to Shopify store conversion optimization HAVE TO consult this agent.
- ux-design-ecommerce-expert: all task related to UX/UI MUST consult this agent
- solution-verification-auditor: all tasks MUST consult this agent during the implementation planning

Sub-agents perform research only; YOU are responsible for the actual implementation. When delegating to a sub-agent, include the session context path .claude/tasks/context_session_<SESSION_ID>.md; after the sub-agent finishes, read their documentation to gain full context before you implement.