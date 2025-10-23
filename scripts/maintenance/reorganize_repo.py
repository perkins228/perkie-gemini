#!/usr/bin/env python3
"""
Repository Reorganization Script
This script will reorganize the repository structure for better organization
"""

import os
import shutil
from pathlib import Path
import json
from datetime import datetime

# Define the new structure
NEW_STRUCTURE = {
    "shopify-theme": {
        "dirs": ["assets", "config", "layout", "locales", "sections", "snippets", "templates"],
        "files": []
    },
    "backend": {
        "inspirenet-api": {
            "from": "inspirenet-bg-removal-api",
            "subdirs": ["src", "tests", "scripts", "development_archive"]
        },
        "image-processor": {
            "from": "image-processor"
        }
    },
    "docs": {
        "subdirs": ["implementation", "architecture", "deployment", "api", "phases", "reference"]
    },
    "scripts": {
        "subdirs": ["deployment", "maintenance", "testing"]
    },
    "tests": {
        "subdirs": ["integration", "e2e"]
    },
    "_archive": {
        "subdirs": ["legacy_backup", "old_docs"]
    }
}

# Files to move to specific locations
FILE_MAPPINGS = {
    "docs/implementation": [
        "BACKEND_IMAGE_STORAGE_IMPLEMENTATION.md",
        "BACKEND_STORE_IMAGE_IMPLEMENTATION.md",
        "CART_INTEGRATION_IMPLEMENTATION.md",
        "cursor_integrate_pet_image_upload_modul.md"
    ],
    "docs/deployment": [
        "DEPLOY_STORAGE_UPDATE.md",
        "UPDATE_SHOPIFY_THEME.md",
        "FIX_STORAGE_ERRORS.md",
        "STORAGE_FIXES_SUMMARY.md"
    ],
    "docs/architecture": [
        "ORGANIZATION.md",
        "PERFORMANCE_OPTIMIZATIONS_SUMMARY.md"
    ],
    "docs/api": [
        "TEST_CUSTOMER_IMAGE_STORAGE.md"
    ]
}

class RepoReorganizer:
    def __init__(self, dry_run=True):
        self.dry_run = dry_run
        self.root = Path.cwd()
        self.operations = []
        self.backup_dir = self.root / f"_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
    def log_operation(self, op_type, source, dest=None):
        """Log an operation for review"""
        op = {
            "type": op_type,
            "source": str(source),
            "dest": str(dest) if dest else None
        }
        self.operations.append(op)
        
        if self.dry_run:
            if op_type == "create_dir":
                print(f"[DRY RUN] Would create directory: {source}")
            elif op_type == "move":
                print(f"[DRY RUN] Would move: {source} -> {dest}")
            elif op_type == "backup":
                print(f"[DRY RUN] Would backup: {source} -> {dest}")
        
    def create_backup(self):
        """Create a backup of the current state"""
        if not self.dry_run:
            print(f"\nCreating backup at: {self.backup_dir}")
            # Create a manifest of current structure
            manifest = {"files": [], "dirs": []}
            
            for item in self.root.iterdir():
                if item.name.startswith('.') or item.name == '_backup':
                    continue
                    
                if item.is_file():
                    manifest["files"].append(item.name)
                elif item.is_dir():
                    manifest["dirs"].append(item.name)
            
            self.backup_dir.mkdir(exist_ok=True)
            
            # Save manifest
            with open(self.backup_dir / "manifest.json", "w") as f:
                json.dump(manifest, f, indent=2)
                
            print(f"Backup manifest created")
        else:
            self.log_operation("backup", self.backup_dir)
    
    def create_directories(self):
        """Create the new directory structure"""
        print("\n=== Creating new directory structure ===")
        
        # Main directories
        for main_dir in ["shopify-theme", "backend", "docs", "scripts", "tests", "_archive"]:
            dir_path = self.root / main_dir
            if not dir_path.exists():
                self.log_operation("create_dir", dir_path)
                if not self.dry_run:
                    dir_path.mkdir(exist_ok=True)
        
        # Shopify theme subdirectories
        shopify_dir = self.root / "shopify-theme"
        for subdir in NEW_STRUCTURE["shopify-theme"]["dirs"]:
            # These directories already exist, we'll move them
            pass
        
        # Backend subdirectories
        backend_dir = self.root / "backend"
        for service in ["inspirenet-api", "image-processor"]:
            service_dir = backend_dir / service
            if not service_dir.exists():
                self.log_operation("create_dir", service_dir)
                if not self.dry_run:
                    service_dir.mkdir(exist_ok=True)
        
        # Docs subdirectories
        docs_dir = self.root / "docs"
        for subdir in NEW_STRUCTURE["docs"]["subdirs"]:
            subdir_path = docs_dir / subdir
            if not subdir_path.exists():
                self.log_operation("create_dir", subdir_path)
                if not self.dry_run:
                    subdir_path.mkdir(exist_ok=True)
        
        # Other subdirectories
        for main_dir in ["scripts", "tests", "_archive"]:
            if main_dir in NEW_STRUCTURE and "subdirs" in NEW_STRUCTURE[main_dir]:
                for subdir in NEW_STRUCTURE[main_dir]["subdirs"]:
                    subdir_path = self.root / main_dir / subdir
                    if not subdir_path.exists():
                        self.log_operation("create_dir", subdir_path)
                        if not self.dry_run:
                            subdir_path.mkdir(exist_ok=True)
    
    def move_shopify_files(self):
        """Move Shopify theme files"""
        print("\n=== Moving Shopify theme files ===")
        
        shopify_dirs = ["assets", "config", "layout", "locales", "sections", "snippets", "templates"]
        shopify_dest = self.root / "shopify-theme"
        
        for dir_name in shopify_dirs:
            source = self.root / dir_name
            if source.exists() and source.is_dir():
                dest = shopify_dest / dir_name
                self.log_operation("move", source, dest)
                if not self.dry_run:
                    shutil.move(str(source), str(dest))
    
    def move_backend_files(self):
        """Move backend service files"""
        print("\n=== Moving backend files ===")
        
        # Move inspirenet-bg-removal-api
        source = self.root / "inspirenet-bg-removal-api"
        if source.exists():
            dest = self.root / "backend" / "inspirenet-api"
            self.log_operation("move", source, dest)
            if not self.dry_run:
                # Move contents, not the directory itself
                for item in source.iterdir():
                    shutil.move(str(item), str(dest))
                try:
                    source.rmdir()
                except Exception as e:
                    print(f"Warning: Could not remove {source}: {e}")
        
        # Move image-processor
        source = self.root / "image-processor"
        if source.exists():
            dest = self.root / "backend" / "image-processor"
            self.log_operation("move", source, dest)
            if not self.dry_run:
                for item in source.iterdir():
                    shutil.move(str(item), str(dest))
                try:
                    source.rmdir()
                except Exception as e:
                    print(f"Warning: Could not remove {source}: {e}")
    
    def move_documentation(self):
        """Move documentation files to appropriate directories"""
        print("\n=== Moving documentation files ===")
        
        # Move existing docs directory contents
        existing_docs = self.root / "docs"
        if existing_docs.exists():
            # Move phases subdirectory
            phases_dir = existing_docs / "phases"
            if phases_dir.exists():
                dest = self.root / "docs" / "phases"
                if str(phases_dir) != str(dest):
                    self.log_operation("move", phases_dir, dest)
                    if not self.dry_run:
                        shutil.move(str(phases_dir), str(dest))
        
        # Move documentation files from root
        for dest_dir, files in FILE_MAPPINGS.items():
            dest_path = self.root / dest_dir
            for file_name in files:
                source = self.root / file_name
                if source.exists() and source.is_file():
                    dest = dest_path / file_name
                    self.log_operation("move", source, dest)
                    if not self.dry_run:
                        shutil.move(str(source), str(dest))
    
    def move_test_files(self):
        """Move test files to centralized location"""
        print("\n=== Moving test files ===")
        
        # Move testing directory
        source = self.root / "testing"
        if source.exists():
            dest = self.root / "tests"
            self.log_operation("move", source, dest)
            if not self.dry_run:
                for item in source.iterdir():
                    dest_item = dest / item.name
                    if item.is_dir():
                        shutil.move(str(item), str(dest_item))
                    else:
                        shutil.move(str(item), str(dest))
                source.rmdir()
    
    def move_archive_files(self):
        """Move archive and backup files"""
        print("\n=== Moving archive files ===")
        
        # Move _legacy_backup
        source = self.root / "_legacy_backup"
        if source.exists():
            dest = self.root / "_archive" / "legacy_backup"
            self.log_operation("move", source, dest)
            if not self.dry_run:
                shutil.move(str(source), str(dest))
    
    def move_reference_materials(self):
        """Move reference materials"""
        print("\n=== Moving reference materials ===")
        
        source = self.root / "reference-materials"
        if source.exists():
            dest = self.root / "docs" / "reference"
            self.log_operation("move", source, dest)
            if not self.dry_run:
                shutil.move(str(source), str(dest))
    
    def create_readme_files(self):
        """Create README files for main directories"""
        print("\n=== Creating README files ===")
        
        readmes = {
            "shopify-theme/README.md": """# Shopify Theme Files

This directory contains all Shopify theme files including:
- `assets/` - CSS, JS, and image files
- `config/` - Theme settings
- `layout/` - Layout templates
- `locales/` - Translation files
- `sections/` - Section templates
- `snippets/` - Reusable code snippets
- `templates/` - Page templates
""",
            "backend/README.md": """# Backend Services

This directory contains all backend services:
- `inspirenet-api/` - Main API for pet background removal
- `image-processor/` - Image processing service
""",
            "docs/README.md": """# Documentation

Project documentation organized by category:
- `implementation/` - Implementation guides and notes
- `architecture/` - System architecture documentation
- `deployment/` - Deployment guides and procedures
- `api/` - API documentation
- `phases/` - Project phase documentation
- `reference/` - Reference materials
"""
        }
        
        for path, content in readmes.items():
            file_path = self.root / path
            self.log_operation("create_file", file_path)
            if not self.dry_run:
                file_path.write_text(content)
    
    def create_gitignore_updates(self):
        """Create updated .gitignore file"""
        print("\n=== Updating .gitignore ===")
        
        gitignore_content = """# Dependencies
node_modules/
*.pyc
__pycache__/
.pytest_cache/

# Environment
.env
.env.local
*.env

# IDE
.vscode/
.idea/
.cursor/
.claude/

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
*.egg-info/

# Logs
*.log
logs/

# Temporary
tmp/
temp/
_backup_*/

# Credentials
*-key.json
*.pem
*.key

# Python
venv/
.venv/
pip-log.txt

# Testing
.coverage
htmlcov/
.tox/
"""
        
        gitignore_path = self.root / ".gitignore"
        self.log_operation("update_file", gitignore_path)
        if not self.dry_run:
            gitignore_path.write_text(gitignore_content)
    
    def save_operations_log(self):
        """Save a log of all operations performed"""
        log_path = self.root / "reorganization_log.json"
        
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "dry_run": self.dry_run,
            "operations": self.operations
        }
        
        if not self.dry_run:
            with open(log_path, "w") as f:
                json.dump(log_data, f, indent=2)
            print(f"\nOperations log saved to: {log_path}")
        else:
            print(f"\n[DRY RUN] Would save operations log to: {log_path}")
    
    def run(self):
        """Run the reorganization"""
        print(f"=== Repository Reorganization {'(DRY RUN)' if self.dry_run else ''} ===")
        
        # Create backup first
        self.create_backup()
        
        # Create new directory structure
        self.create_directories()
        
        # Move files
        self.move_shopify_files()
        self.move_backend_files()
        self.move_documentation()
        self.move_test_files()
        self.move_archive_files()
        self.move_reference_materials()
        
        # Create documentation
        self.create_readme_files()
        self.create_gitignore_updates()
        
        # Save operations log
        self.save_operations_log()
        
        print(f"\n{'[DRY RUN] ' if self.dry_run else ''}Reorganization complete!")
        print(f"Total operations: {len(self.operations)}")
        
        if self.dry_run:
            print("\nTo execute these changes, run with --execute flag")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Reorganize repository structure")
    parser.add_argument("--execute", action="store_true", 
                        help="Execute the reorganization (default is dry run)")
    args = parser.parse_args()
    
    reorganizer = RepoReorganizer(dry_run=not args.execute)
    reorganizer.run()


if __name__ == "__main__":
    main()