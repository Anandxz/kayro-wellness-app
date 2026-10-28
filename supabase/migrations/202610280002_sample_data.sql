-- Repeatable fictional assignment data. ISO dates/times, Asia/Kolkata, E.164.
-- Null represents Meera's missing phone; it is never filled with a fake value.
begin;
insert into public.demo_workspaces (id, expires_at, is_template)
values ('00000000-0000-0000-0000-000000000000', 'infinity', true)
on conflict (id) do nothing;
insert into public.appointments (workspace_id, seed_key, client_name, phone, service_id, starts_at, ends_at, status)
values
('00000000-0000-0000-0000-000000000000', 'assignment-1', 'Riya Shah', '+919820011111', 'follow-up', '2026-10-24T10:00:00+05:30', '2026-10-24T10:30:00+05:30', 'Booked'),
('00000000-0000-0000-0000-000000000000', 'assignment-2', 'Arjun Mehta', '+919820022222', 'follow-up', '2026-10-24T11:30:00+05:30', '2026-10-24T12:00:00+05:30', 'Booked'),
('00000000-0000-0000-0000-000000000000', 'assignment-3', 'Riya Shah', '+919820011111', 'follow-up', '2026-10-25T16:00:00+05:30', '2026-10-25T16:30:00+05:30', 'Booked'),
('00000000-0000-0000-0000-000000000000', 'assignment-4', 'Meera Iyer', null, 'follow-up', '2026-10-23T09:00:00+05:30', '2026-10-23T09:30:00+05:30', 'Done'),
('00000000-0000-0000-0000-000000000000', 'assignment-5', 'Kabir Rao', '+919820033333', 'follow-up', '2026-10-22T14:00:00+05:30', '2026-10-22T14:30:00+05:30', 'No-show')
on conflict (workspace_id, seed_key) do nothing;
commit;
