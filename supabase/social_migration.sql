-- Run this in the Supabase dashboard SQL editor

-- Follow relationships (asymmetric)
create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique (follower_id, following_id)
);

alter table follows enable row level security;
create policy "follows_select" on follows for select using (true);
create policy "follows_insert" on follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete" on follows for delete using (auth.uid() = follower_id);

-- Comments on albums or whole lists
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  body text not null check (char_length(body) between 1 and 500),
  -- album-level comment
  album_id uuid references albums(id) on delete cascade,
  -- list-level comment
  list_owner_id uuid references auth.users(id) on delete cascade,
  list_year int,
  created_at timestamptz default now() not null,
  constraint comment_target check (
    (album_id is not null and list_owner_id is null and list_year is null) or
    (album_id is null and list_owner_id is not null and list_year is not null)
  )
);

alter table comments enable row level security;
create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on comments for delete using (auth.uid() = user_id);
