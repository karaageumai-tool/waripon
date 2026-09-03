create table if not exists public.splits (
  id text primary key check (id ~ '^[A-Za-z0-9]{12,32}$'),
  data jsonb not null default '{"members":[],"expenses":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.splits enable row level security;
revoke all on table public.splits from anon, authenticated;

create or replace function public.get_split(split_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('data', data, 'updatedAt', updated_at)
  from public.splits
  where id = split_id
    and split_id ~ '^[A-Za-z0-9]{12,32}$';
$$;

create or replace function public.save_split(split_id text, split_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_at timestamptz := clock_timestamp();
begin
  if split_id !~ '^[A-Za-z0-9]{12,32}$' then
    raise exception 'Invalid split ID';
  end if;

  if jsonb_typeof(split_data -> 'members') <> 'array'
     or jsonb_typeof(split_data -> 'expenses') <> 'array'
     or octet_length(split_data::text) > 100000 then
    raise exception 'Invalid split data';
  end if;

  insert into public.splits (id, data, updated_at)
  values (split_id, split_data, saved_at)
  on conflict (id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at;

  return jsonb_build_object('updatedAt', saved_at);
end;
$$;

revoke all on function public.get_split(text) from public;
revoke all on function public.save_split(text, jsonb) from public;
grant execute on function public.get_split(text) to anon, authenticated;
grant execute on function public.save_split(text, jsonb) to anon, authenticated;
