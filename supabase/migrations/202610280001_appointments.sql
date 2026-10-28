begin;
create extension if not exists btree_gist;

create table public.demo_workspaces (
  id uuid primary key,
  expires_at timestamptz not null default (now() + interval '7 days'),
  is_template boolean not null default false,
  mutation_window timestamptz not null default now(),
  mutation_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index demo_workspaces_expiry_idx on public.demo_workspaces (expires_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.demo_workspaces(id) on delete cascade,
  practitioner_id uuid not null default '00000000-0000-0000-0000-000000000001',
  client_name text not null check (char_length(btrim(client_name)) between 2 and 80),
  phone text check (phone ~ '^\+[1-9][0-9]{9,14}$'),
  service_id text not null check (service_id in ('initial', 'follow-up')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Generated presentation columns cannot disagree with the canonical instant.
  appointment_date date generated always as ((starts_at at time zone 'Asia/Kolkata')::date) stored,
  appointment_time time generated always as ((starts_at at time zone 'Asia/Kolkata')::time) stored,
  status text not null default 'Booked' check (status in ('Booked', 'Done', 'No-show')),
  cancelled_at timestamptz,
  seed_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, seed_key),
  check (ends_at = starts_at + case service_id when 'initial' then interval '45 minutes' else interval '30 minutes' end),
  check (cancelled_at is null or status = 'Booked'),
  -- Completed and no-show visits still reserve their historical time. Only
  -- cancellation releases it. [) permits back-to-back consultations.
  constraint appointments_no_overlap exclude using gist (
    workspace_id with =, practitioner_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (cancelled_at is null)
);
create index appointments_workspace_start_idx on public.appointments (workspace_id, starts_at);

create function public.touch_appointment() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
create trigger appointments_touch before update on public.appointments for each row execute function public.touch_appointment();

alter table public.demo_workspaces enable row level security;
alter table public.appointments enable row level security;
-- Deliberately no anon/authenticated policies. Browser keys cannot read/write.
revoke all on public.demo_workspaces, public.appointments from public, anon, authenticated;
grant select, insert, update, delete on public.demo_workspaces, public.appointments to service_role;

create function public.create_demo_workspace(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Global cap protects this assignment demo from unbounded session creation.
  perform pg_advisory_xact_lock(817291);
  delete from public.demo_workspaces where not is_template and expires_at < now();
  if (select count(*) from public.demo_workspaces where not is_template) >= 2000 then
    raise exception using errcode = 'P0001', message = 'Demo capacity reached. Please try later.';
  end if;
  insert into public.demo_workspaces (id) values (p_id);
  insert into public.appointments (workspace_id, client_name, phone, service_id, starts_at, ends_at, status, seed_key)
  select p_id, a.client_name, a.phone, a.service_id, a.starts_at, a.ends_at, a.status, a.seed_key
    from public.appointments a join public.demo_workspaces w on w.id = a.workspace_id where w.is_template;
end $$;

create function public.mutate_appointment(
  p_workspace uuid, p_action text, p_id uuid default null,
  p_name text default null, p_phone text default null, p_service text default null,
  p_starts timestamptz default null, p_status text default null
) returns setof public.appointments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  w public.demo_workspaces;
  a public.appointments;
  duration interval;
  local_start timestamp;
begin
  -- Serialize writes in a workspace, including quotas and competing updates.
  -- The exclusion constraint is also effective for writes outside this RPC.
  select * into w from public.demo_workspaces where id = p_workspace and not is_template and expires_at > now() for update;
  if not found then raise exception using errcode = 'P0002', message = 'Demo session expired. Reload to start again.'; end if;
  if w.mutation_window < now() - interval '10 minutes' then
    update public.demo_workspaces set mutation_window = now(), mutation_count = 1 where id = p_workspace;
  elsif w.mutation_count >= 60 then
    raise exception using errcode = 'P0001', message = 'Too many changes. Please wait a few minutes.';
  else
    update public.demo_workspaces set mutation_count = mutation_count + 1 where id = p_workspace;
  end if;

  if p_action <> 'book' then
    select * into a from public.appointments where workspace_id = p_workspace and id = p_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'Appointment not found.'; end if;
    if a.cancelled_at is not null or a.status <> 'Booked' then
      raise exception using errcode = 'P0001', message = 'This appointment can no longer be changed.';
    end if;
  end if;

  if p_action in ('book', 'reschedule') then
    if p_action = 'reschedule' then
      if a.starts_at <= now() then raise exception using errcode = 'P0001', message = 'Past appointments cannot be rescheduled.'; end if;
      if a.starts_at = p_starts then raise exception using errcode = 'P0001', message = 'Choose a different time.'; end if;
      p_service := a.service_id;
    end if;
    if p_service is null or p_service not in ('initial', 'follow-up') then raise exception using errcode = '22023', message = 'Invalid consultation.'; end if;
    duration := case p_service when 'initial' then interval '45 minutes' else interval '30 minutes' end;
    local_start := p_starts at time zone 'Asia/Kolkata';
    if p_starts is null or p_starts <= now()
      or local_start::date > (now() at time zone 'Asia/Kolkata')::date + 14
      or extract(dow from local_start) = 0
      or local_start::time not in ('09:00', '10:00', '11:00', '11:30', '12:00', '14:00', '15:00', '16:00') then
      raise exception using errcode = '22023', message = 'Choose a valid future appointment slot within 14 days.';
    end if;
    if p_action = 'book' then
      if p_name is null or char_length(btrim(p_name)) not between 2 and 80 or p_phone is null or p_phone !~ '^\+[1-9][0-9]{9,14}$' then
        raise exception using errcode = '22023', message = 'A valid name and phone number are required.';
      end if;
      if (select count(*) from public.appointments where workspace_id = p_workspace) >= 100 then
        raise exception using errcode = 'P0001', message = 'This demo workspace has reached its 100-appointment limit.';
      end if;
      insert into public.appointments (workspace_id, client_name, phone, service_id, starts_at, ends_at)
        values (p_workspace, btrim(p_name), p_phone, p_service, p_starts, p_starts + duration) returning * into a;
    else
      update public.appointments set starts_at = p_starts, ends_at = p_starts + duration
        where id = a.id and workspace_id = p_workspace returning * into a;
    end if;
  elsif p_action = 'cancel' then
    if a.starts_at <= now() then raise exception using errcode = 'P0001', message = 'Past appointments cannot be cancelled.'; end if;
    update public.appointments set cancelled_at = now() where id = a.id and workspace_id = p_workspace returning * into a;
  elsif p_action = 'status' then
    -- Attendance is one-way: Booked -> Done or No-show, only once it starts.
    if p_status is null or p_status not in ('Done', 'No-show') or a.starts_at > now() then
      raise exception using errcode = '22023', message = 'Only started Booked appointments can become Done or No-show.';
    end if;
    update public.appointments set status = p_status where id = a.id and workspace_id = p_workspace returning * into a;
  else
    raise exception using errcode = '22023', message = 'Invalid action.';
  end if;
  return next a;
end $$;
revoke all on function public.touch_appointment() from public, anon, authenticated;
revoke all on function public.create_demo_workspace(uuid) from public, anon, authenticated;
revoke all on function public.mutate_appointment(uuid,text,uuid,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.create_demo_workspace(uuid) to service_role;
grant execute on function public.mutate_appointment(uuid,text,uuid,text,text,text,timestamptz,text) to service_role;
commit;
