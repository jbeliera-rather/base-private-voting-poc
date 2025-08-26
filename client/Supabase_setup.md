# Supabase Setup Guide

This guide will help you set up and configure Supabase for the voting application.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. Node.js and npm installed
3. The required packages installed:
   ```bash
   npm install @supabase/supabase-js
   ```

## Setup Steps

1. **Create a Supabase Project**
   - Log in to your Supabase account
   - Create a new project
   - Note down your project URL and anon key from the project settings

2. **Configure Environment Variables**
   - Create or update your `.env.local` file with:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_project_url
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     ```
   - For Vercel deployment, add the same environment variables in your project settings

3. **Set Up Database Schema**
   Run the following SQL in the Supabase SQL editor:

   ```sql
   -- Create votings table
   CREATE TABLE IF NOT EXISTS votings (
     id BIGSERIAL PRIMARY KEY,
     title TEXT NOT NULL,
     description TEXT NOT NULL,
     start_date TIMESTAMP WITH TIME ZONE NOT NULL,
     end_date TIMESTAMP WITH TIME ZONE NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'pending')),
     max_voters INTEGER,
     vote_threshold INTEGER,
     is_public BOOLEAN NOT NULL DEFAULT false,
     amount DECIMAL
   );

   -- Create voting_options table
   CREATE TABLE IF NOT EXISTS voting_options (
     id BIGSERIAL PRIMARY KEY,
     voting_id BIGINT REFERENCES votings(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     description TEXT NOT NULL,
     address TEXT,
     votes INTEGER NOT NULL DEFAULT 0
   );

   -- Create nullifiers table
   CREATE TABLE IF NOT EXISTS nullifiers (
     id BIGSERIAL PRIMARY KEY,
     nullifier TEXT NOT NULL UNIQUE,
     voting_id BIGINT REFERENCES votings(id) ON DELETE CASCADE
   );

   -- Create function to add a vote
   CREATE OR REPLACE FUNCTION add_vote(
     p_nullifier TEXT,
     p_voting_id BIGINT,
     p_option_id BIGINT
   ) RETURNS void AS $$
   BEGIN
     -- Add the nullifier
     INSERT INTO nullifiers (nullifier, voting_id)
     VALUES (p_nullifier, p_voting_id);
     
     -- Update the vote count
     UPDATE voting_options
     SET votes = votes + 1
     WHERE id = p_option_id;
   END;
   $$ LANGUAGE plpgsql;

   -- Create functions for table creation
   CREATE OR REPLACE FUNCTION create_votings_table()
   RETURNS void AS $$
   BEGIN
     CREATE TABLE IF NOT EXISTS votings (
       id BIGSERIAL PRIMARY KEY,
       title TEXT NOT NULL,
       description TEXT NOT NULL,
       start_date TIMESTAMP WITH TIME ZONE NOT NULL,
       end_date TIMESTAMP WITH TIME ZONE NOT NULL,
       status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'pending')),
       max_voters INTEGER,
       vote_threshold INTEGER,
       is_public BOOLEAN NOT NULL DEFAULT false,
       amount DECIMAL
     );
   END;
   $$ LANGUAGE plpgsql;

   CREATE OR REPLACE FUNCTION create_voting_options_table()
   RETURNS void AS $$
   BEGIN
     CREATE TABLE IF NOT EXISTS voting_options (
       id BIGSERIAL PRIMARY KEY,
       voting_id BIGINT REFERENCES votings(id) ON DELETE CASCADE,
       name TEXT NOT NULL,
       description TEXT NOT NULL,
       address TEXT,
       votes INTEGER NOT NULL DEFAULT 0
     );
   END;
   $$ LANGUAGE plpgsql;

   CREATE OR REPLACE FUNCTION create_nullifiers_table()
   RETURNS void AS $$
   BEGIN
     CREATE TABLE IF NOT EXISTS nullifiers (
       id BIGSERIAL PRIMARY KEY,
       nullifier TEXT NOT NULL UNIQUE,
       voting_id BIGINT REFERENCES votings(id) ON DELETE CASCADE
     );
   END;
   $$ LANGUAGE plpgsql;

   -- Create RLS policies
   ALTER TABLE votings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE voting_options ENABLE ROW LEVEL SECURITY;
   ALTER TABLE nullifiers ENABLE ROW LEVEL SECURITY;

   -- Allow public read access to votings
   CREATE POLICY "Allow public read access to votings"
   ON votings FOR SELECT
   USING (true);

   -- Allow public read access to voting_options
   CREATE POLICY "Allow public read access to voting_options"
   ON voting_options FOR SELECT
   USING (true);

   -- Allow service role full access
   CREATE POLICY "Allow service role full access to votings"
   ON votings FOR ALL
   USING (auth.role() = 'service_role');

   CREATE POLICY "Allow service role full access to voting_options"
   ON voting_options FOR ALL
   USING (auth.role() = 'service_role');

   CREATE POLICY "Allow service role full access to nullifiers"
   ON nullifiers FOR ALL
   USING (auth.role() = 'service_role');
   ```

4. **Migration for Existing Databases**
   If you already have a database set up, run this migration to add the new fields:
   
   ```sql
   -- Add amount column to votings table
   ALTER TABLE votings ADD COLUMN IF NOT EXISTS amount DECIMAL;
   
   -- Add address column to voting_options table
   ALTER TABLE voting_options ADD COLUMN IF NOT EXISTS address TEXT;
   ```

## Database Schema

The application uses the following tables:

1. **votings**
   - `id`: BIGSERIAL PRIMARY KEY
   - `title`: TEXT NOT NULL
   - `description`: TEXT NOT NULL
   - `start_date`: TIMESTAMP WITH TIME ZONE NOT NULL
   - `end_date`: TIMESTAMP WITH TIME ZONE NOT NULL
   - `status`: TEXT NOT NULL (active/closed/pending)
   - `max_voters`: INTEGER
   - `vote_threshold`: INTEGER
   - `is_public`: BOOLEAN NOT NULL DEFAULT false
   - `amount`: DECIMAL

2. **voting_options**
   - `id`: BIGSERIAL PRIMARY KEY
   - `voting_id`: BIGINT REFERENCES votings(id)
   - `name`: TEXT NOT NULL
   - `description`: TEXT NOT NULL
   - `address`: TEXT
   - `votes`: INTEGER NOT NULL DEFAULT 0

3. **nullifiers**
   - `id`: BIGSERIAL PRIMARY KEY
   - `nullifier`: TEXT NOT NULL UNIQUE
   - `voting_id`: BIGINT REFERENCES votings(id)

