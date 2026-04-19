#!/bin/bash

# TestForge - Behavioral Tracking Setup Script
# This script sets up the behavioral tracking tables and triggers

echo "🔧 TestForge - Behavioral Tracking Setup"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with your Supabase credentials"
    exit 1
fi

# Load environment variables
source .env

# Check if required variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env"
    exit 1
fi

# Extract database connection details from Supabase URL
# Format: https://[project-ref].supabase.co
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')

echo "📊 Project: $PROJECT_REF"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

echo "🔍 Checking current database state..."
echo ""

# Run the migration
echo "🚀 Running migration: migration_behavioral_tables.sql"
echo ""

# Note: You'll need to get the actual database connection string from Supabase dashboard
# This is a placeholder - users should update with their actual connection details
echo "⚠️  Manual Step Required:"
echo ""
echo "Please run the following command with your Supabase database credentials:"
echo ""
echo "psql 'postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres' -f migration_behavioral_tables.sql"
echo ""
echo "Or use the Supabase SQL Editor to run the migration file directly."
echo ""
echo "📝 Migration file location: server/migration_behavioral_tables.sql"
echo ""

# Offer to open the migration file
read -p "Would you like to view the migration file? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cat migration_behavioral_tables.sql
fi

echo ""
echo "✅ Setup instructions displayed"
echo ""
echo "Next steps:"
echo "1. Run the migration SQL file in Supabase SQL Editor"
echo "2. Verify tables created: behavioral_flags, behavioral_details"
echo "3. Test with: node --env-file=.env seed_behavioral.js"
echo "4. Check admin integrity view to see flags"
echo ""
