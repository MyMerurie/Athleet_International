package com.athleet.academy.student.domain;

import com.athleet.core.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

/** One entry in a student's injury log. Health data: never logged, audited without details. */
@Entity
@Table(name = "student_injury")
public class StudentInjury extends BaseEntity {

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @Column(name = "injury_date", nullable = false) private LocalDate injuryDate;
    @Column(name = "body_part", nullable = false) private String bodyPart;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InjurySeverity severity;

    private String description;
    @Column(name = "recovered_on") private LocalDate recoveredOn;

    protected StudentInjury() {
    }

    public StudentInjury(UUID organizationId, UUID studentId) {
        this.organizationId = organizationId;
        this.studentId = studentId;
    }

    public void update(LocalDate injuryDate, String bodyPart, InjurySeverity severity, String description, LocalDate recoveredOn) {
        this.injuryDate = injuryDate;
        this.bodyPart = bodyPart;
        this.severity = severity;
        this.description = description;
        this.recoveredOn = recoveredOn;
    }

    public UUID getOrganizationId() { return organizationId; }
    public UUID getStudentId() { return studentId; }
    public LocalDate getInjuryDate() { return injuryDate; }
    public String getBodyPart() { return bodyPart; }
    public InjurySeverity getSeverity() { return severity; }
    public String getDescription() { return description; }
    public LocalDate getRecoveredOn() { return recoveredOn; }
}
