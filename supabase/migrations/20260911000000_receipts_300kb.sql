begin;

-- Keep existing images readable; apply the tighter limit to new writes.
alter table public.receipts drop constraint receipts_bytes_check;
alter table public.receipts add constraint receipts_bytes_check
  check (bytes between 1 and 300000) not valid;

create or replace function public.reserve_receipt(p_split text, p_expense text, p_bytes integer)
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
  if p_bytes is null or p_bytes < 1 or p_bytes > 300000 then
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

commit;
