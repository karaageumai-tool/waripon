begin;

-- Intentionally no cascading FK: metadata must survive split deletion until R2
-- deletion succeeds. Only the Worker may access these tables and RPCs.
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  split_id text not null,
  expense_id text not null,
  bytes integer not null check (bytes between 1 and 512000),
  state text not null default 'pending' check (state in ('pending', 'ready', 'deleting')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index receipts_split_expense_idx on public.receipts (split_id, expense_id);
create index receipts_expiration_idx on public.receipts (expires_at);
create table public.receipt_quota (
  id boolean primary key default true check (id),
  used_bytes bigint not null default 0 check (used_bytes >= 0),
  limit_bytes bigint not null default 8000000000 check (limit_bytes >= 0)
);
insert into public.receipt_quota (id) values (true);
alter table public.receipts enable row level security;
alter table public.receipt_quota enable row level security;
revoke all on public.receipts, public.receipt_quota from public, anon, authenticated, service_role;

create function public.receipt_expense_exists(p_split text, p_expense text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.splits s,
    lateral jsonb_array_elements(s.data -> 'expenses') e
    where s.id = p_split and s.expires_at > now() and e ->> 'id' = p_expense);
$$;

create function public.reserve_receipt(p_split text, p_expense text, p_bytes integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  deadline timestamptz;
  quota public.receipt_quota;
  item public.receipts;
begin
  -- One global lock serializes quota and count reservations across all Workers.
  select * into quota from public.receipt_quota where id = true for update;
  select expires_at into deadline from public.splits where id = p_split for share;
  if deadline is null or not public.receipt_expense_exists(p_split, p_expense) then
    raise exception 'RECEIPT_NOT_FOUND';
  end if;
  if p_bytes is null or p_bytes < 1 or p_bytes > 512000 then
    raise exception 'RECEIPT_TOO_LARGE';
  end if;
  if quota.used_bytes + p_bytes > quota.limit_bytes then raise exception 'RECEIPT_QUOTA'; end if;
  if (select count(*) from public.receipts where split_id = p_split
      and expense_id = p_expense) >= 3 then raise exception 'RECEIPT_LIMIT'; end if;
  insert into public.receipts(split_id, expense_id, bytes, expires_at)
    values(p_split, p_expense, p_bytes, deadline) returning * into item;
  update public.receipt_quota set used_bytes = used_bytes + p_bytes where id = true;
  return to_jsonb(item);
end;
$$;

create function public.finish_receipt(p_split text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item public.receipts;
begin
  update public.receipts set state = 'ready'
    where id = p_id and split_id = p_split and state = 'pending' and expires_at > now()
    and public.receipt_expense_exists(split_id, expense_id) returning * into item;
  if item.id is null then return null; end if;
  return to_jsonb(item);
end;
$$;

create function public.list_receipts(p_split text, p_expense text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.receipt_expense_exists(p_split, p_expense) then raise exception 'RECEIPT_NOT_FOUND'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'bytes', bytes,
    'expiresAt', expires_at) order by created_at), '[]'::jsonb)
    from public.receipts where split_id = p_split and expense_id = p_expense
    and state = 'ready' and expires_at > now());
end;
$$;

create function public.access_receipt(p_split text, p_id uuid, p_delete boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item public.receipts;
begin
  select * into item from public.receipts where id = p_id and split_id = p_split
    and state = 'ready' and expires_at > now()
    and public.receipt_expense_exists(split_id, expense_id) for update;
  if item.id is null then return null; end if;
  if p_delete then update public.receipts set state = 'deleting' where id = item.id; end if;
  return to_jsonb(item);
end;
$$;

-- Mark before deleting R2; failed deletions remain eligible on the next run.
create function public.receipts_to_delete()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  with selected as (
    select id from public.receipts where state = 'deleting'
      or (state = 'pending' and created_at < now() - interval '1 hour')
      or (state = 'ready' and (expires_at <= now()
        or not public.receipt_expense_exists(split_id, expense_id)))
    order by expires_at, id limit 100 for update skip locked
  ), marked as (
    update public.receipts set state = 'deleting' where id in (select id from selected)
    returning id
  ) select coalesce(jsonb_agg(id), '[]'::jsonb) into result from marked;
  return result;
end;
$$;

create function public.forget_receipts(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare released bigint;
begin
  perform 1 from public.receipt_quota where id = true for update;
  with removed as (delete from public.receipts where id = any(p_ids)
    and state = 'deleting' returning bytes)
    select coalesce(sum(bytes), 0) into released from removed;
  update public.receipt_quota set used_bytes = used_bytes - released where id = true;
end;
$$;

revoke all on function public.receipt_expense_exists(text,text),
  public.reserve_receipt(text,text,integer), public.finish_receipt(text,uuid),
  public.list_receipts(text,text), public.access_receipt(text,uuid,boolean),
  public.receipts_to_delete(), public.forget_receipts(uuid[])
  from public, anon, authenticated;
grant execute on function public.reserve_receipt(text,text,integer),
  public.finish_receipt(text,uuid), public.list_receipts(text,text),
  public.access_receipt(text,uuid,boolean), public.receipts_to_delete(),
  public.forget_receipts(uuid[]) to service_role;

commit;
