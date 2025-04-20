#!/bin/bash

# Function to confirm action
confirm() {
    read -r -p "${1:-Are you sure? [y/N]} " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            true
            ;;
        *)
            false
            ;;
    esac
}

# Check if Supabase is running
if ! npx supabase status | grep -q "Started"; then
    echo "Error: Supabase is not running. Please start Supabase first."
    echo "Run: npx supabase start"
    exit 1
fi

# Warn the user about resetting the database
if confirm "This script will reset your local Supabase database. All data will be lost. Continue? [y/N]"; then
    # Reset the database
    echo "Resetting database..."
    npx supabase db reset
    
    # Check if reset was successful
    if [ $? -ne 0 ]; then
        echo "Error: Failed to reset database."
        exit 1
    fi

    # Apply migrations in the correct order
    echo "Applying migrations..."
    
    echo "1. Applying schema creation migration..."
    psql "$(npx supabase db connection-string)" -f ./supabase/migrations/20240510000000_create_ricochet_robots_schema.sql
    
    echo "2. Applying game functions migration..."
    psql "$(npx supabase db connection-string)" -f ./supabase/migrations/20240510000001_add_game_functions.sql
    
    echo "3. Applying game policies migration..."
    psql "$(npx supabase db connection-string)" -f ./supabase/migrations/20240510000002_add_game_policies.sql
    
    echo "4. Applying friends functionality migration..."
    psql "$(npx supabase db connection-string)" -f ./supabase/migrations/20240510000003_add_friends_functionality.sql
    
    echo "5. Applying round timeout functionality migration..."
    psql "$(npx supabase db connection-string)" -f ./supabase/migrations/20240510000004_add_round_timeout_functionality.sql
    
    echo "Migration process completed successfully!"
else
    echo "Reset cancelled."
fi 