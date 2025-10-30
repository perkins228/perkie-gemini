#!/usr/bin/env python3
"""
Pre-reorganization safety check script
Analyzes the repository and identifies potential issues before reorganization
"""

import os
from pathlib import Path
import json

class RepoAnalyzer:
    def __init__(self):
        self.root = Path.cwd()
        self.issues = []
        self.stats = {
            "total_files": 0,
            "total_dirs": 0,
            "file_types": {},
            "large_files": [],
            "git_tracked": 0,
            "untracked": []
        }
    
    def check_git_status(self):
        """Check if there are uncommitted changes"""
        print("Checking git status...")
        
        try:
            import subprocess
            result = subprocess.run(["git", "status", "--porcelain"], 
                                  capture_output=True, text=True)
            
            if result.stdout.strip():
                self.issues.append({
                    "type": "WARNING",
                    "message": "Uncommitted changes detected. Please commit or stash changes before reorganizing.",
                    "details": result.stdout.strip().split('\n')[:10]  # First 10 files
                })
        except Exception as e:
            self.issues.append({
                "type": "ERROR",
                "message": f"Could not check git status: {e}"
            })
    
    def analyze_structure(self):
        """Analyze current repository structure"""
        print("Analyzing repository structure...")
        
        for item in self.root.rglob("*"):
            if any(part.startswith('.') for part in item.parts):
                continue  # Skip hidden directories
                
            if item.is_file():
                self.stats["total_files"] += 1
                
                # Track file types
                ext = item.suffix.lower()
                if ext:
                    self.stats["file_types"][ext] = self.stats["file_types"].get(ext, 0) + 1
                
                # Check for large files
                size_mb = item.stat().st_size / (1024 * 1024)
                if size_mb > 10:
                    self.stats["large_files"].append({
                        "path": str(item.relative_to(self.root)),
                        "size_mb": round(size_mb, 2)
                    })
                    
            elif item.is_dir():
                self.stats["total_dirs"] += 1
    
    def check_duplicates(self):
        """Check for potential duplicate files"""
        print("Checking for duplicates...")
        
        # Check for test files in multiple locations
        test_files = list(self.root.rglob("test_*.py"))
        if len(test_files) > 10:
            self.issues.append({
                "type": "INFO",
                "message": f"Found {len(test_files)} test files scattered across the repository",
                "details": [str(f.relative_to(self.root)) for f in test_files[:5]]
            })
        
        # Check for multiple README files
        readme_files = list(self.root.rglob("README*"))
        if len(readme_files) > 5:
            self.issues.append({
                "type": "INFO",
                "message": f"Found {len(readme_files)} README files",
                "details": [str(f.relative_to(self.root)) for f in readme_files]
            })
    
    def check_sensitive_files(self):
        """Check for sensitive files that shouldn't be moved"""
        print("Checking for sensitive files...")
        
        sensitive_patterns = [
            "*.key",
            "*.pem",
            "*-key.json",
            ".env*",
            "*.secret"
        ]
        
        sensitive_files = []
        for pattern in sensitive_patterns:
            for file in self.root.rglob(pattern):
                if not any(part.startswith('.') for part in file.parts):
                    sensitive_files.append(str(file.relative_to(self.root)))
        
        if sensitive_files:
            self.issues.append({
                "type": "WARNING",
                "message": f"Found {len(sensitive_files)} potentially sensitive files",
                "details": sensitive_files
            })
    
    def generate_report(self):
        """Generate analysis report"""
        print("\n" + "="*60)
        print("REPOSITORY ANALYSIS REPORT")
        print("="*60)
        
        print(f"\nRepository Statistics:")
        print(f"  Total files: {self.stats['total_files']}")
        print(f"  Total directories: {self.stats['total_dirs']}")
        
        print(f"\nTop file types:")
        sorted_types = sorted(self.stats['file_types'].items(), 
                            key=lambda x: x[1], reverse=True)[:10]
        for ext, count in sorted_types:
            print(f"  {ext}: {count} files")
        
        if self.stats['large_files']:
            print(f"\nLarge files (>10MB):")
            for file in self.stats['large_files'][:5]:
                print(f"  {file['path']}: {file['size_mb']}MB")
        
        print(f"\nIssues and Warnings:")
        if not self.issues:
            print("  No issues found!")
        else:
            for issue in self.issues:
                print(f"\n  [{issue['type']}] {issue['message']}")
                if 'details' in issue and issue['details']:
                    for detail in issue['details'][:5]:
                        print(f"    - {detail}")
                    if len(issue['details']) > 5:
                        print(f"    ... and {len(issue['details']) - 5} more")
        
        # Save detailed report
        report_path = self.root / "pre_reorganization_report.json"
        report_data = {
            "stats": self.stats,
            "issues": self.issues
        }
        
        with open(report_path, "w") as f:
            json.dump(report_data, f, indent=2)
        
        print(f"\nDetailed report saved to: {report_path}")
        
        # Safety check
        has_errors = any(issue['type'] == 'ERROR' for issue in self.issues)
        has_warnings = any(issue['type'] == 'WARNING' for issue in self.issues)
        
        if has_errors:
            print("\n⚠️  ERRORS FOUND - Please resolve before reorganizing!")
            return False
        elif has_warnings:
            print("\n⚠️  WARNINGS FOUND - Please review before proceeding!")
            return False
        else:
            print("\n✅ Repository appears ready for reorganization!")
            return True
    
    def run(self):
        """Run all checks"""
        self.check_git_status()
        self.analyze_structure()
        self.check_duplicates()
        self.check_sensitive_files()
        return self.generate_report()


def main():
    print("Running pre-reorganization checks...")
    analyzer = RepoAnalyzer()
    
    if analyzer.run():
        print("\nTo proceed with reorganization:")
        print("1. First run: python reorganize_repo.py")
        print("   (This will show what changes will be made)")
        print("2. If everything looks good, run: python reorganize_repo.py --execute")
    else:
        print("\nPlease address the issues before reorganizing.")


if __name__ == "__main__":
    main()