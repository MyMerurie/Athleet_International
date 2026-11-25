-- Student records: tags, injury log and an append-only history of lifecycle and placement events.
create table student_tag (
    student_id uuid        not null references student (id) on delete cascade,
    tag        varchar(40) not null,
    constraint pk_student_tag primary key (student_id, tag)
);
create unique index ux_student_tag_ci on student_tag (student_id, lower(tag));

create table student_injury (
    id              uuid primary key,
    version         bigint       not null,
    created_at      timestamptz  not null,
    updated_at      timestamptz  not null,
    organization_id uuid         not null references organization (id),
    student_id      uuid         not null references student (id) on delete cascade,
    injury_date     date         not null,
    body_part       varchar(60)  not null,
    severity        varchar(10)  not null,
    description     varchar(1000),
    recovered_on    date,
    constraint ck_injury_severity check (severity in ('MINOR', 'MODERATE', 'SEVERE')),
    constraint ck_injury_recovered check (recovered_on is null or recovered_on >= injury_date)
);
create index ix_student_injury_student on student_injury (student_id, injury_date desc);
create index ix_student_injury_org on student_injury (organization_id);

-- Names are snapshots so the history stays readable after a class, batch or academy is renamed.
create table student_history (
    id              uuid primary key,
    organization_id uuid         not null references organization (id),
    student_id      uuid         not null references student (id) on delete cascade,
    event_type      varchar(20)  not null,
    occurred_at     timestamptz  not null,
    actor_user_id   uuid references app_user (id),
    from_academy    varchar(150),
    to_academy      varchar(150),
    from_center     varchar(100),
    to_center       varchar(100),
    from_batches    varchar(600),
    to_batches      varchar(600),
    constraint ck_student_history_event check (event_type in
        ('REGISTERED', 'APPROVED', 'PLACEMENT_CHANGED', 'TRANSFERRED', 'DEACTIVATED', 'REACTIVATED', 'DEREGISTERED'))
);
create index ix_student_history_student on student_history (student_id, occurred_at desc);

-- Existing students get the events we can still derive.
insert into student_history (id, organization_id, student_id, event_type, occurred_at)
select gen_random_uuid(), organization_id, id, 'REGISTERED', created_at from student;

insert into student_history (id, organization_id, student_id, event_type, occurred_at)
select gen_random_uuid(), organization_id, id, 'DEREGISTERED', deregistered_at from student where deregistered_at is not null;
