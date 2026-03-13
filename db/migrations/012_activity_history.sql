create table if not exists public.activity_history (
  id bigserial primary key,

  entity_type text not null,
  entity_id text not null,

  event_type text not null,
  field_name text null,

  previous_value jsonb null,
  new_value jsonb null,

  message text null,

  module text null,

  user_id text null,
  user_name text null,
  employee_number integer null,

  sales_order bigint null,
  detail_number integer null,

  created_at timestamptz not null default now()
);

create index if not exists ix_activity_history_entity_created
  on public.activity_history (entity_type, entity_id, created_at desc, id desc);

create index if not exists ix_activity_history_event_type
  on public.activity_history (event_type);

create index if not exists ix_activity_history_module
  on public.activity_history (module);

create index if not exists ix_activity_history_sales_order_detail
  on public.activity_history (sales_order, detail_number, created_at desc);

create index if not exists ix_activity_history_created_at
  on public.activity_history (created_at desc);