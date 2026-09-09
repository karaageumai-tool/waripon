-- Existing rows have no creation timestamp; use their last known update.
alter table public.splits add column created_at timestamptz;
alter table public.splits add column expires_at timestamptz;
update public.splits set created_at = updated_at,
  expires_at = (updated_at at time zone 'UTC' + interval '6 months') at time zone 'UTC';
alter table public.splits alter column created_at set default now();
alter table public.splits alter column created_at set not null;
alter table public.splits alter column expires_at set default
  ((now() at time zone 'UTC' + interval '6 months') at time zone 'UTC');
alter table public.splits alter column expires_at set not null;
create index splits_expires_at_idx on public.splits (expires_at);

-- Only the server issues IDs. Updates must never recreate deleted URLs.
create function public.create_split()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  new_split public.splits;
begin
  insert into public.splits (id)
  values (replace(gen_random_uuid()::text, '-', '')) returning * into new_split;
  return jsonb_build_object('id', new_split.id, 'expiresAt', new_split.expires_at);
end;
$$;
revoke all on function public.create_split() from public;
grant execute on function public.create_split() to anon, authenticated;

create or replace function public.get_split(split_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('data', data, 'updatedAt', updated_at, 'expiresAt', expires_at)
  from public.splits where id = split_id and expires_at > now();
$$;

create or replace function public.save_split(split_id text, split_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saved_at timestamptz := clock_timestamp();
begin
  if split_id is null or split_id !~ '^[A-Za-z0-9]{12,32}$' then
    raise exception 'Invalid split ID';
  end if;
  if jsonb_typeof(split_data -> 'members') is distinct from 'array'
     or jsonb_typeof(split_data -> 'expenses') is distinct from 'array'
     or octet_length(split_data::text) > 100000 then
    raise exception 'Invalid split data';
  end if;
  update public.splits set data = split_data, updated_at = saved_at
    where id = split_id and expires_at > saved_at;
  if not found then return null; end if;
  return jsonb_build_object('updatedAt', saved_at);
end;
$$;

create extension if not exists pg_cron;
select cron.schedule('delete-expired-splits', '* * * * *',
  $$delete from public.splits where expires_at <= now()$$);
