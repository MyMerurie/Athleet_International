-- Player Unique ID auto-generation: one row per organization. Unique ID = prefix + student number when switched on.
create table student_config (
    id               uuid primary key,
    version          bigint      not null,
    created_at       timestamptz not null,
    updated_at       timestamptz not null,
    organization_id  uuid        not null unique references organization (id),
    unique_id_auto   boolean     not null default false,
    unique_id_prefix varchar(10) not null default '',
    constraint ck_student_config_prefix check (unique_id_prefix ~ '^[A-Z0-9-]*$')
);

-- Duplicate Unique IDs are rejected by the service; this index keeps that check fast.
create index ix_student_org_unique_id on student (organization_id, lower(unique_id));
