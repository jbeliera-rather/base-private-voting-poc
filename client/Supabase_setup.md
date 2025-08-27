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
   -- Create main tables 
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
     amount DECIMAL,
     funds_distributed BOOLEAN NOT NULL DEFAULT false,
     distribution_tx_hash TEXT
   );

   CREATE TABLE IF NOT EXISTS voting_options (
     id BIGSERIAL PRIMARY KEY,
     voting_id BIGINT REFERENCES votings(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     description TEXT NOT NULL,
     address TEXT,
     votes INTEGER NOT NULL DEFAULT 0
   );

   CREATE TABLE IF NOT EXISTS nullifiers (
     id BIGSERIAL PRIMARY KEY,
     nullifier TEXT NOT NULL UNIQUE,
     voting_id BIGINT REFERENCES votings(id) ON DELETE CASCADE
   );

   -- Create function to add a vote (atomic operation)
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

   -- Enable Row Level Security
   ALTER TABLE votings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE voting_options ENABLE ROW LEVEL SECURITY;
   ALTER TABLE nullifiers ENABLE ROW LEVEL SECURITY;

   -- Create RLS policies (using IF NOT EXISTS pattern)
   DO $$
   BEGIN
     -- Public read access to votings
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies 
       WHERE tablename = 'votings' 
       AND policyname = 'Allow public read access to votings'
     ) THEN
       CREATE POLICY "Allow public read access to votings"
       ON votings FOR SELECT
       USING (true);
     END IF;

     -- Public read access to voting_options
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies 
       WHERE tablename = 'voting_options' 
       AND policyname = 'Allow public read access to voting_options'
     ) THEN
       CREATE POLICY "Allow public read access to voting_options"
       ON voting_options FOR SELECT
       USING (true);
     END IF;

     -- Service role full access to votings
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies 
       WHERE tablename = 'votings' 
       AND policyname = 'Allow service role full access to votings'
     ) THEN
       CREATE POLICY "Allow service role full access to votings"
       ON votings FOR ALL
       USING (auth.role() = 'service_role');
     END IF;

     -- Service role full access to voting_options
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies 
       WHERE tablename = 'voting_options' 
       AND policyname = 'Allow service role full access to voting_options'
     ) THEN
       CREATE POLICY "Allow service role full access to voting_options"
       ON voting_options FOR ALL
       USING (auth.role() = 'service_role');
     END IF;

     -- Service role full access to nullifiers
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies 
       WHERE tablename = 'nullifiers' 
       AND policyname = 'Allow service role full access to nullifiers'
     ) THEN
       CREATE POLICY "Allow service role full access to nullifiers"
       ON nullifiers FOR ALL
       USING (auth.role() = 'service_role');
     END IF;
   END
   $$;
   ```


## Database Schema

The application uses the following tables:

### **votings**
- `id`: BIGSERIAL PRIMARY KEY
- `title`: TEXT NOT NULL
- `description`: TEXT NOT NULL
- `start_date`: TIMESTAMP WITH TIME ZONE NOT NULL
- `end_date`: TIMESTAMP WITH TIME ZONE NOT NULL
- `status`: TEXT NOT NULL (active/closed/pending)
- `max_voters`: INTEGER (optional limit on total voters)
- `vote_threshold`: INTEGER (optional threshold to auto-close)
- `is_public`: BOOLEAN NOT NULL DEFAULT false (whether results are public)
- `amount`: DECIMAL (ETH amount for funding)
- `funds_distributed`: BOOLEAN NOT NULL DEFAULT false (distribution status)
- `distribution_tx_hash`: TEXT (transaction hash for fund distribution)

### **voting_options**
- `id`: BIGSERIAL PRIMARY KEY
- `voting_id`: BIGINT REFERENCES votings(id) ON DELETE CASCADE
- `name`: TEXT NOT NULL
- `description`: TEXT NOT NULL
- `address`: TEXT (recipient address for funding)
- `votes`: INTEGER NOT NULL DEFAULT 0

### **nullifiers**
- `id`: BIGSERIAL PRIMARY KEY
- `nullifier`: TEXT NOT NULL UNIQUE (prevents double voting)
- `voting_id`: BIGINT REFERENCES votings(id) ON DELETE CASCADE

## Features

- **Zero-Knowledge Voting**: Uses nullifiers to prevent double voting while maintaining privacy
- **Funding Support**: Elections can have ETH amounts that are automatically distributed to winners
- **Flexible Timing**: Elections can be scheduled for future dates and auto-close
- **Public/Private Results**: Results can be visible during voting or only after closure
- **Vote Thresholds**: Elections can auto-close when a threshold is reached
- **Voter Limits**: Maximum number of voters can be set

## Security

- **Row Level Security (RLS)**: Enabled on all tables
- **Public Read Access**: Voting data is publicly readable
- **Service Role Access**: Full access for server operations
- **Atomic Voting**: Vote additions are atomic to prevent race conditions
- **Duplicate Prevention**: Nullifiers prevent duplicate votes
- **Fund Protection**: Distribution tracking prevents duplicate transactions

