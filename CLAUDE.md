# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Project Overview

This is the Perkie Prints Shopify theme repository - a custom e-commerce platform where 70% of orders come from mobile, featuring FREE AI-powered pet background removal and image processing capabilities as a conversion tool. The project combines a Shopify Dawn-based theme with KondaSoft components and a production-ready Python API service. This is a totally NEW build and has NOT been deployed to actual customers. All of our testing is being done in a staging enviroment so no actual customer data exist.

**Business Model**: Pet background removal is a FREE service to drive product sales, not a revenue source itself. Focus on conversion optimization.

## 🏗️ Architecture

### Frontend (Shopify Theme)
- **Base**: Shopify Dawn theme + KondaSoft components
- **Key Integration**: Pet Processor V5 in `assets/pet-processor-v5-es5.js`
- **Unified System**: Comprehensive pet system in `assets/pet-processor-unified.js`
- **Pet Selector**: Product variant system in `snippets/ks-product-pet-selector.liquid`
- **Session Management**: Enhanced localStorage with emergency cleanup methods
- **Progressive Loading**: ES5-compatible implementation with fallback support

### Backend (AI API)
- **Service**: InSPyReNet Background Removal API in `backend/inspirenet-api/`
- **Technology**: FastAPI + PyTorch + InSPyReNet model
- **Deployment**: Google Cloud Run with NVIDIA L4 GPU
- **Performance**: 11s first request, 3s subsequent (with caching)

## 🔧 Development & Deployment

### Shopify Theme Deployment
**IMPORTANT: We use GitHub auto-deployment, NOT Shopify CLI**

```bash
# All theme changes are deployed automatically via GitHub
git add .
git commit -m "Your descriptive commit message"
git push origin staging

# The GitHub integration automatically deploys to Shopify staging
# No need for Shopify CLI commands
```

**Deployment Flow:**
1. Make changes locally
2. Test using Playwright MCP with staging URL
3. Commit and push to `staging` branch
4. GitHub automatically deploys to Shopify staging environment
5. Changes appear on staging URL within ~1-2 minutes

### API Development (InSPyReNet)
```bash
cd backend/inspirenet-api

# Install dependencies
pip install -r requirements.txt

# Run locally (CPU mode)
python src/main.py

# Run tests
python tests/test_processing.py

# Deploy to Cloud Run
./scripts/deploy-model-fix.sh
```

### Testing
```bash
# API integration tests
cd backend/inspirenet-api/tests
python test_processing.py
python test_mobile_processing.py

# Frontend tests - open in browser
testing/pet-processor-v5-test.html
testing/progressive-loading-test.html
testing/unified-pet-system-test.html
```

## 🔄 Git Workflow

This project uses a **staging branch approach**:

### Branch Structure
- **main**: Production-ready code, deployed to live store
- **staging**: Development branch, used for testing and integration
- **feature branches**: Created from staging for specific features

### Workflow
```bash
# Create feature branch from staging
git checkout staging
git pull origin staging
git checkout -b feature/your-feature-name

# Work on feature, commit changes
git add .
git commit -m "Your commit message"

# Push feature branch and create PR to staging
git push origin feature/your-feature-name

# After review, merge to staging for testing
# Once tested, create PR from staging to main
```

### Important Notes
- Always create feature branches from `staging`
- Test thoroughly in staging before merging to main
- Use descriptive commit messages following the existing style
- Coordinate with team before major architectural changes

## 📁 Key Files & Directories

### Frontend Files
- `assets/pet-processor-v5-es5.js` - Main pet background remover logic (ES5 compatible)
- `assets/pet-processor-unified.js` - Unified pet system implementation
- `sections/ks-pet-bg-remover.liquid` - Background remover section
- `snippets/ks-product-pet-selector.liquid` - Pet selection UI component
- `templates/page.pet-background-remover.json` - Background remover page template

### API Files
- `backend/inspirenet-api/src/main.py` - API entry point
- `backend/inspirenet-api/src/effects/` - Image effect processors
- `backend/inspirenet-api/src/api_v2_endpoints.py` - V2 API endpoints
- `backend/inspirenet-api/deploy-production-clean.yaml` - Cloud Run configuration
- `backend/inspirenet-api/scripts/deploy-model-fix.sh` - Deployment script

### Configuration
- `config/settings_schema.json` - Theme settings
- `config/settings_data.json` - Theme configuration data

## 🚀 API Endpoints

Production URL: `https://inspirenet-bg-removal-api-725543555429.us-central1.run.app`

- `POST /remove-background` - Remove background from image
- `POST /api/v2/process` - Process image with effects (blackwhite, popart, dithering, 8bit)
- `POST /api/v2/process-with-effects` - Enhanced processing with multiple effects and progressive loading
- `GET /health` - Health check
- `GET /model-info` - Model information

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
- Emergency cleanup method: `window.emergencyCleanupPetData()`
- Automatic session restoration on page reload
- Progressive loading state persistence

### Testing Approach
- **PRIMARY METHOD**: Use Playwright MCP with Shopify staging URL
  - Current staging: `https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/`
  - If expired, ASK USER for new URL before using local tests
  - See `.claude/TESTING_STRATEGY.md` for detailed testing procedures
- **SECONDARY**: Local HTML test files only when staging unavailable
- Python tests in `backend/inspirenet-api/tests/` for API testing
- **NO Shopify CLI** - All deployments happen via GitHub push to staging

### Deployment Notes
- API uses Google Cloud Run with GPU support
- Automatic scaling 0-10 instances
- Cloud Storage caching with 24-hour TTL
- Monitor costs - GPU instances are expensive (~$65/1000 images)
- **CRITICAL: NEVER set min-instances > 0** - We must keep costs down. Cold starts are acceptable.
- Min-instances must always remain at 0 to avoid $65-100/day in idle GPU costs
- Use frontend warming and caching strategies instead of keeping instances alive

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
   - Solution: Use `window.emergencyCleanupPetData()` to reset

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

## 🔒 Security Considerations

- Never commit Google Cloud service account keys
- API has no authentication - add for production use
- Validate all file uploads (max 50MB, image formats only)
- Use environment variables for sensitive configuration
- Please remember to always coordinate with all appropriate agents to plan, code, and review your solution before implementing
- Always remember to avoid overengineering, our solution should be as elegant as it is simple.
- Always remember to do a root cause analysis when faced with a problem. Focus on correcting the root causes rather than just the symptoms

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