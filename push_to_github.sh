#!/bin/bash
set -e

REPO_URL="https://AnandPandey:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/AnandPandey/Nexus.git"

echo "Setting up GitHub remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo "Pulling remote changes..."
git fetch origin main 2>/dev/null || true
git merge origin/main --allow-unrelated-histories --no-edit 2>/dev/null || true

echo "Pushing to GitHub..."
git push -u origin main

echo "Done! Your code is now on GitHub: https://github.com/AnandPandey/Nexus"
