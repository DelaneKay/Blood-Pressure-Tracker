create table if not exists public.logs (
  id text primary key,
  timestamp_sast timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists logs_timestamp_sast_idx
  on public.logs (timestamp_sast desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists logs_set_updated_at on public.logs;

create trigger logs_set_updated_at
before update on public.logs
for each row
execute function public.set_updated_at();
