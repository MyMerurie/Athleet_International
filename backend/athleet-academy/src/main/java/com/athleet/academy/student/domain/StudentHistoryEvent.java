package com.athleet.academy.student.domain;

/** Kinds of entries in a student's history. TRANSFERRED, DEACTIVATED and REACTIVATED are written by later phases. */
public enum StudentHistoryEvent { REGISTERED, APPROVED, PLACEMENT_CHANGED, TRANSFERRED, DEACTIVATED, REACTIVATED, DEREGISTERED }
