-- Student profile: kit size and up to three secondary contacts per student.
alter table student add column kit_size varchar(10);

create table student_contact (
    id              uuid primary key,
    version         bigint       not null,
    created_at      timestamptz  not null,
    updated_at      timestamptz  not null,
    organization_id uuid         not null references organization (id),
    student_id      uuid         not null references student (id) on delete cascade,
    name            varchar(120) not null,
    relationship    varchar(40),
    country_code    varchar(5),
    mobile          varchar(15)  not null,
    email           varchar(254),
    sort_order      integer      not null default 0
);
create index ix_student_contact_student on student_contact (student_id);
create index ix_student_contact_org on student_contact (organization_id);
