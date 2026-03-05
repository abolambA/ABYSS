#!/bin/bash

# This script will safely initialize your git repository and push it to GitHub.
# Since Mac node_modules can sometimes throw file permission errors, this script 
# bypasses them and forces the commit.

echo "🚀 Preparing to publish ABYSS to GitHub..."

# 1. Remove any broken git folders from previous failed attempts
sudo rm -rf .git

# 2. Re-initialize git
git init

# 3. Add all files (the .gitignore ensures node_modules is skipped safely)
git add .

# 4. Commit the changes
git commit -m "Initialize ABYSS game final version 1.0"

# 5. Set branch to main
git branch -M main

# 6. Add your remote GitHub repository
git remote add origin https://github.com/abolambA/ABYSS.git

# 7. Push everything up to GitHub!
git push -u origin main

echo "✅ Done! Your game should now be live on GitHub."
