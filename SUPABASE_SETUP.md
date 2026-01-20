# Supabase Setup Instructions

## 1. Create a Supabase Project
1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Once the project is ready, go to **Project Settings** -> **API**.
3. Copy the **Project URL** and **anon / public** Key.
4. Create a file named `.env.local` in the root of your project (if it doesn't exist) and add the keys:
   ```
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

## 2. Database Setup (SQL)
Go to the **SQL Editor** in your Supabase dashboard and run the following script to set up the table and security policies.

```sql
-- 1. Create the leaderboard table
create table leaderboard (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  score bigint not null,
  time_played bigint not null, -- stored in milliseconds
  max_tier int not null,
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security (RLS)
alter table leaderboard enable row level security;

-- 3. Create Policy: Allow Public Read Access
-- Anyone can view the leaderboard
create policy "Enable read access for all users"
on leaderboard
for select
using (true);

-- 4. Create Policy: Allow Public Insert Access
-- Anyone can upload a score
create policy "Enable insert access for all users"
on leaderboard
for insert
with check (true);

-- Note: We intentionally do NOT add Update or Delete policies.
-- This prevents users from modifying or deleting existing scores via the API.
```

## 3. Restart the Dev Server
After adding the `.env.local` file, make sure to restart your development server so the environment variables are loaded.
