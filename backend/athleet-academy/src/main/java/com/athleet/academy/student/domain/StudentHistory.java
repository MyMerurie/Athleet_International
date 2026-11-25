package com.athleet.academy.student.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** Append-only. Holds names (not ids) of where the student was, so it stays readable after renames. */
@Entity
@Table(name = "student_history")
public class StudentHistory {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private StudentHistoryEvent eventType;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();

    @Column(name = "actor_user_id") private UUID actorUserId;
    @Column(name = "from_academy") private String fromAcademy;
    @Column(name = "to_academy") private String toAcademy;
    @Column(name = "from_center") private String fromCenter;
    @Column(name = "to_center") private String toCenter;
    @Column(name = "from_batches") private String fromBatches;
    @Column(name = "to_batches") private String toBatches;

    protected StudentHistory() {
    }

    public StudentHistory(UUID organizationId, UUID studentId, StudentHistoryEvent eventType, UUID actorUserId) {
        this.organizationId = organizationId;
        this.studentId = studentId;
        this.eventType = eventType;
        this.actorUserId = actorUserId;
    }

    public StudentHistory placement(String fromCenter, String fromBatches, String toCenter, String toBatches) {
        this.fromCenter = trim(fromCenter, 100);
        this.fromBatches = trim(fromBatches, 600);
        this.toCenter = trim(toCenter, 100);
        this.toBatches = trim(toBatches, 600);
        return this;
    }

    public StudentHistory academies(String fromAcademy, String toAcademy) {
        this.fromAcademy = trim(fromAcademy, 150);
        this.toAcademy = trim(toAcademy, 150);
        return this;
    }

    private static String trim(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    public UUID getId() { return id; }
    public UUID getStudentId() { return studentId; }
    public StudentHistoryEvent getEventType() { return eventType; }
    public Instant getOccurredAt() { return occurredAt; }
    public UUID getActorUserId() { return actorUserId; }
    public String getFromAcademy() { return fromAcademy; }
    public String getToAcademy() { return toAcademy; }
    public String getFromCenter() { return fromCenter; }
    public String getToCenter() { return toCenter; }
    public String getFromBatches() { return fromBatches; }
    public String getToBatches() { return toBatches; }
}
