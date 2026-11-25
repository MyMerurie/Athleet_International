-- Students can be switched to INACTIVE (and back to ACTIVE) in bulk, without deregistering them.
alter table student drop constraint ck_student_status;
alter table student add constraint ck_student_status check (status in ('ACTIVE', 'SUBMITTED', 'INACTIVE', 'DEREGISTERED'));
