-- supabase/migrations/20260311000000_create_chat_tables.sql

create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  title       text not null default 'Нов разговор',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz default now()
);

-- Row-Level Security
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "Users see own conversations"
  on conversations for all
  using (auth.uid() = user_id);

create policy "Users see messages in own conversations"
  on messages for all
  using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

-- Index for sidebar queries (list by user, sorted by updated_at)
create index conversations_user_id_updated_at_idx
  on conversations(user_id, updated_at desc);

-- Index for loading messages in a conversation
create index messages_conversation_id_created_at_idx
  on messages(conversation_id, created_at asc);
