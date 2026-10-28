begin;
alter table public.appointments add column revision uuid not null default gen_random_uuid();
create function public.bump_appointment_revision() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.revision := gen_random_uuid(); return new; end $$;
create trigger appointments_revision before update on public.appointments
  for each row execute function public.bump_appointment_revision();
revoke all on function public.bump_appointment_revision() from public, anon, authenticated;

create function public.mutate_appointment_checked(
  p_workspace uuid, p_action text, p_expected_revision uuid default null,
  p_id uuid default null, p_name text default null, p_phone text default null,
  p_service text default null, p_starts timestamptz default null, p_status text default null
) returns setof public.appointments
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.appointments;
begin
  -- Same lock order as the underlying RPC: workspace, then appointment.
  perform 1 from public.demo_workspaces where id = p_workspace and not is_template and expires_at > now() for update;
  if not found then raise exception using errcode = 'P0002', message = 'Demo session expired. Reload to start again.'; end if;
  if p_action <> 'book' then
    select * into a from public.appointments where workspace_id = p_workspace and id = p_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'Appointment not found.'; end if;
    if p_expected_revision is null or a.revision <> p_expected_revision then
      raise exception using errcode = '40001', message = 'This appointment has changed. Refresh and review it before trying again.';
    end if;
  end if;
  return query select * from public.mutate_appointment(
    p_workspace, p_action, p_id, p_name, p_phone, p_service, p_starts, p_status);
end $$;
revoke all on function public.mutate_appointment_checked(uuid,text,uuid,uuid,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.mutate_appointment_checked(uuid,text,uuid,uuid,text,text,text,timestamptz,text) to service_role;
revoke all on function public.mutate_appointment(uuid,text,uuid,text,text,text,timestamptz,text) from service_role;
commit;
notify pgrst, 'reload schema';
