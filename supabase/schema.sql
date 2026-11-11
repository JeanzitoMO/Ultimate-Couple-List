-- ============ TABELAS ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 30),
  avatar_url text,
  role text not null default 'member' check (role in ('admin','member')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.media (
  id bigint generated always as identity primary key,
  source text not null check (source in ('tmdb','jikan','manual')),
  external_id text,
  title text not null check (char_length(title) between 1 and 200),
  type text not null check (type in ('movie','series','anime','cartoon')),
  cover_url text,
  synopsis text,
  platform text,
  total_seasons int check (total_seasons >= 0),
  total_episodes int check (total_episodes >= 0),
  unique (source, external_id)
);

create table public.watch_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  media_id bigint not null references public.media on delete cascade,
  status text not null check (status in ('want','watching','completed','dropped')),
  season int not null default 1 check (season >= 1),
  episode int not null default 0 check (episode >= 0),
  rating numeric(2,1) check (rating between 0 and 5),
  review text check (char_length(review) <= 500),
  updated_at timestamptz not null default now(),
  unique (user_id, media_id)
);

-- ============ FUNÇÕES / TRIGGERS ============
create function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false)
$$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nickname'), ''), 'Usuário'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger watch_progress_touch before update on public.watch_progress
  for each row execute function public.touch_updated_at();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.media enable row level security;
alter table public.watch_progress enable row level security;

-- profiles: cada um lê o próprio; aprovados leem todos. Só nickname/avatar editáveis.
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_approved());
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (nickname, avatar_url) on public.profiles to authenticated;

-- media: aprovados leem e criam
create policy "media_select" on public.media for select using (public.is_approved());
create policy "media_insert" on public.media for insert with check (public.is_approved());
create policy "media_update" on public.media for update using (public.is_approved());

-- watch_progress: aprovados leem tudo do casal; escrevem só o próprio
create policy "wp_select" on public.watch_progress for select using (public.is_approved());
create policy "wp_insert" on public.watch_progress for insert
  with check (public.is_approved() and user_id = auth.uid());
create policy "wp_update" on public.watch_progress for update
  using (public.is_approved() and user_id = auth.uid());
create policy "wp_delete" on public.watch_progress for delete
  using (public.is_approved() and user_id = auth.uid());

-- ============ STORAGE (avatares: 2MB, jpg/png/gif) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/gif']);

create policy "avatars_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ ADMIN INICIAL ============
-- 1) Crie o usuário no painel Supabase (Authentication > Users) com e-mail e senha.
-- 2) Rode (trocando o e-mail) para torná-lo admin aprovado:
-- update public.profiles set role='admin', approved=true, nickname='Absolas'
--   where id = (select id from auth.users where email = 'SEU-EMAIL');
