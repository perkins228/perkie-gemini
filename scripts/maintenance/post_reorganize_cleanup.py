#!/usr/bin/env python3
"""
Post-reorganization cleanup script
Updates import paths and cleans up after reorganization
"""

import os
import re
from pathlib import Path

class PostReorgCleanup:
    def __init__(self):
        self.root = Path.cwd()
        self.updates_made = []
    
    def update_import_paths(self):
        """Update Python import paths in moved files"""
        print("Updating Python import paths...")
        
        # Map old paths to new paths
        path_mappings = {
            "inspirenet-bg-removal-api": "backend/inspirenet-api",
            "from src.": "from ",  # Since we're now in src directory
            "../inspirenet-bg-removal-api": "../backend/inspirenet-api"
        }
        
        # Find all Python files in backend
        backend_dir = self.root / "backend"
        if backend_dir.exists():
            for py_file in backend_dir.rglob("*.py"):
                content = py_file.read_text(encoding='utf-8')
                original = content
                
                for old, new in path_mappings.items():
                    content = content.replace(old, new)
                
                if content != original:
                    py_file.write_text(content, encoding='utf-8')
                    self.updates_made.append(f"Updated imports in: {py_file.relative_to(self.root)}")
    
    def update_dockerfile_paths(self):
        """Update paths in Dockerfiles"""
        print("Updating Dockerfile paths...")
        
        dockerfiles = list(self.root.rglob("Dockerfile*"))
        
        for dockerfile in dockerfiles:
            content = dockerfile.read_text(encoding='utf-8')
            original = content
            
            # Update COPY commands
            content = re.sub(r'COPY inspirenet-bg-removal-api/', 'COPY backend/inspirenet-api/', content)
            content = re.sub(r'WORKDIR /app/inspirenet-bg-removal-api', 'WORKDIR /app/backend/inspirenet-api', content)
            
            if content != original:
                dockerfile.write_text(content, encoding='utf-8')
                self.updates_made.append(f"Updated paths in: {dockerfile.relative_to(self.root)}")
    
    def update_github_workflows(self):
        """Update GitHub workflow files"""
        print("Checking GitHub workflows...")
        
        workflows_dir = self.root / ".github" / "workflows"
        if workflows_dir.exists():
            for workflow in workflows_dir.glob("*.yml"):
                content = workflow.read_text(encoding='utf-8')
                original = content
                
                # Update paths
                content = content.replace('inspirenet-bg-removal-api/', 'backend/inspirenet-api/')
                content = content.replace('./inspirenet-bg-removal-api', './backend/inspirenet-api')
                
                if content != original:
                    workflow.write_text(content, encoding='utf-8')
                    self.updates_made.append(f"Updated workflow: {workflow.relative_to(self.root)}")
    
    def update_readme(self):
        """Update main README with new structure"""
        print("Updating README...")
        
        readme_path = self.root / "README.md"
        
        new_structure_section = """
## Repository Structure

```
.
├── shopify-theme/     # Shopify theme files (assets, templates, etc.)
├── backend/           # Backend services
│   ├── inspirenet-api/    # Pet background removal API
│   └── image-processor/   # Image processing service
├── docs/              # Documentation
│   ├── implementation/    # Implementation guides
│   ├── architecture/      # System architecture
│   ├── deployment/        # Deployment guides
│   └── api/              # API documentation
├── scripts/           # Utility scripts
├── tests/             # Integration tests
└── _archive/          # Archived code and backups
```
"""
        
        if readme_path.exists():
            content = readme_path.read_text(encoding='utf-8')
            
            # Check if structure section exists
            if "## Repository Structure" not in content:
                # Add after the first heading
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if line.startswith('# '):
                        lines.insert(i + 2, new_structure_section)
                        break
                
                readme_path.write_text('\n'.join(lines), encoding='utf-8')
                self.updates_made.append("Added repository structure to README.md")
    
    def create_development_guide(self):
        """Create a development guide for the new structure"""
        print("Creating development guide...")
        
        guide_content = """# Development Guide

## Quick Start

### Working with the Shopify Theme
```bash
cd shopify-theme
# Theme development commands here
```

### Working with the Backend API
```bash
cd backend/inspirenet-api
python -m venv venv
source venv/bin/activate  # or venv\\Scripts\\activate on Windows
pip install -r requirements.txt
python src/main.py
```

### Running Tests
```bash
# Backend tests
cd backend/inspirenet-api
pytest tests/

# Integration tests
cd tests/integration
pytest
```

## Key Directories

- **shopify-theme/**: All Shopify theme files
  - Liquid templates, CSS, JavaScript
  - Theme configuration

- **backend/inspirenet-api/**: Main API service
  - Pet background removal
  - Image effects processing
  - Customer storage management

- **backend/image-processor/**: Legacy image processing service

- **docs/**: All project documentation
  - Implementation notes
  - API documentation
  - Deployment guides

## Common Tasks

### Adding a New Feature
1. Create feature branch
2. Implement in appropriate directory
3. Add tests
4. Update documentation
5. Submit PR

### Deploying Changes
- Shopify theme: See `docs/deployment/UPDATE_SHOPIFY_THEME.md`
- Backend API: See `docs/deployment/DEPLOY_STORAGE_UPDATE.md`

### Environment Setup
1. Copy `.env.example` to `.env`
2. Fill in required values
3. Install dependencies
"""
        
        guide_path = self.root / "DEVELOPMENT_GUIDE.md"
        guide_path.write_text(guide_content, encoding='utf-8')
        self.updates_made.append("Created DEVELOPMENT_GUIDE.md")
    
    def remove_empty_directories(self):
        """Remove any empty directories left after reorganization"""
        print("Cleaning up empty directories...")
        
        def remove_empty_dirs(path):
            """Recursively remove empty directories"""
            if not path.is_dir():
                return
            
            # Process subdirectories first
            for child in list(path.iterdir()):
                if child.is_dir():
                    remove_empty_dirs(child)
            
            # Remove if empty
            try:
                if not any(path.iterdir()):
                    path.rmdir()
                    self.updates_made.append(f"Removed empty directory: {path.relative_to(self.root)}")
            except:
                pass  # Directory not empty or permission issues
        
        # Skip certain directories
        skip_dirs = {'.git', '.github', 'node_modules', '__pycache__'}
        
        for item in self.root.iterdir():
            if item.is_dir() and item.name not in skip_dirs:
                remove_empty_dirs(item)
    
    def generate_report(self):
        """Generate cleanup report"""
        print("\n" + "="*60)
        print("POST-REORGANIZATION CLEANUP REPORT")
        print("="*60)
        
        if self.updates_made:
            print(f"\nUpdates made ({len(self.updates_made)}):")
            for update in self.updates_made:
                print(f"  - {update}")
        else:
            print("\nNo updates were necessary.")
        
        print("\n✅ Cleanup complete!")
        
        # Save report
        report_path = self.root / "post_reorganization_report.txt"
        with open(report_path, "w") as f:
            f.write("Post-Reorganization Cleanup Report\n")
            f.write("="*60 + "\n\n")
            f.write(f"Total updates: {len(self.updates_made)}\n\n")
            for update in self.updates_made:
                f.write(f"- {update}\n")
        
        print(f"\nReport saved to: {report_path}")
    
    def run(self):
        """Run all cleanup tasks"""
        self.update_import_paths()
        self.update_dockerfile_paths()
        self.update_github_workflows()
        self.update_readme()
        self.create_development_guide()
        self.remove_empty_directories()
        self.generate_report()


def main():
    print("Running post-reorganization cleanup...")
    cleanup = PostReorgCleanup()
    cleanup.run()
    
    print("\nNext steps:")
    print("1. Review the changes made")
    print("2. Test that everything still works")
    print("3. Commit the reorganized structure")


if __name__ == "__main__":
    main()