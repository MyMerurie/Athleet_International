package com.athleet.academy.student.domain;

/**
 * ACTIVE = enrolled; SUBMITTED = self-registered, awaiting approval (Acadware "Submitted" tab);
 * INACTIVE = paused: kept on record but left out of rosters, attendance and headcounts until activated again.
 */
public enum StudentStatus { ACTIVE, SUBMITTED, INACTIVE, DEREGISTERED }
