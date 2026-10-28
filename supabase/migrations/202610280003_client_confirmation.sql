begin;
-- Separate intent/reminder state from Booked / Done / No-show attendance.
alter table public.appointments
  add column client_confirmed_at timestamptz,
  add column reminder_dismissed_at timestamptz;

create function public.reset_appointment_confirmation() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.starts_at is distinct from old.starts_at or new.cancelled_at is distinct from old.cancelled_at then
    new.client_confirmed_at := null;
    new.reminder_dismissed_at := null;
  end if;
  return new;
end $$;
create trigger appointments_reset_confirmation before update on public.appointments
  for each row execute function public.reset_appointment_confirmation();
revoke all on function public.reset_appointment_confirmation() from public, anon, authenticated;

-- Retain the existing atomic booking rules unchanged, behind the same public RPC.
alter function public.mutate_appointment(uuid,text,uuid,text,text,text,timestamptz,text)
  rename to mutate_appointment_base;
revoke all on function public.mutate_appointment_base(uuid,text,uuid,text,text,text,timestamptz,text)
  from public, anon, authenticated, service_role;

create function public.mutate_appointment(
  p_workspace uuid, p_action text, p_id uuid default null,
  p_name text default null, p_phone text default null, p_service text default null,
  p_starts timestamptz default null, p_status text default null
) returns setof public.appointments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  w public.demo_workspaces;
  a public.appointments;
begin
  if p_action not in ('confirm', 'dismiss-reminder') then
    return query select * from public.mutate_appointment_base(
      p_workspace, p_action, p_id, p_name, p_phone, p_service, p_starts, p_status);
    return;
  end if;
  select * into w from public.demo_workspaces
    where id = p_workspace and not is_template and expires_at > now() for update;
  if not found then raise exception using errcode = 'P0002', message = 'Demo session expired. Reload to start again.'; end if;
  select * into a from public.appointments where workspace_id = p_workspace and id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Appointment not found.'; end if;
  if a.status <> 'Booked' or a.cancelled_at is not null or a.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'Only upcoming Booked appointments can be confirmed or reminded.';
  end if;
  if p_starts is null or p_starts <> a.starts_at then
    raise exception using errcode = 'P0001', message = 'Your appointment time has changed. Please review it before confirming.';
  end if;
  if p_action = 'dismiss-reminder' and a.starts_at > now() + interval '24 hours' then
    raise exception using errcode = '22023', message = 'This reminder is not due yet.';
  end if;
  -- Repeated confirmations/dismissals are idempotent, including network retries.
  if (p_action = 'confirm' and a.client_confirmed_at is not null)
    or (p_action = 'dismiss-reminder' and a.reminder_dismissed_at is not null) then
    return next a; return;
  end if;
  if w.mutation_window < now() - interval '10 minutes' then
    update public.demo_workspaces set mutation_window = now(), mutation_count = 1 where id = p_workspace;
  elsif w.mutation_count >= 60 then
    raise exception using errcode = 'P0001', message = 'Too many changes. Please wait a few minutes.';
  else
    update public.demo_workspaces set mutation_count = mutation_count + 1 where id = p_workspace;
  end if;
  if p_action = 'confirm' then
    update public.appointments set client_confirmed_at = now() where id = a.id and workspace_id = p_workspace returning * into a;
  else
    update public.appointments set reminder_dismissed_at = now() where id = a.id and workspace_id = p_workspace returning * into a;
  end if;
  return next a;
end $$;
revoke all on function public.mutate_appointment(uuid,text,uuid,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.mutate_appointment(uuid,text,uuid,text,text,text,timestamptz,text) to service_role;
commit;
