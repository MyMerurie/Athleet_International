package com.athleet.academy.student.service;

import com.athleet.academy.common.Text;
import com.athleet.academy.student.domain.Student;
import com.athleet.academy.student.domain.StudentInjury;
import com.athleet.academy.student.domain.StudentStatus;
import com.athleet.academy.student.dto.StudentDtos.InjuryRequest;
import com.athleet.academy.student.dto.StudentDtos.InjuryResponse;
import com.athleet.academy.student.repository.StudentInjuryRepository;
import com.athleet.academy.student.repository.StudentRepository;
import com.athleet.core.audit.service.AuditService;
import com.athleet.core.common.error.BusinessRuleException;
import com.athleet.core.common.error.NotFoundException;
import com.athleet.core.iam.domain.AccessLevel;
import com.athleet.core.iam.domain.AppModule;
import com.athleet.core.iam.service.AccessService;
import com.athleet.core.iam.service.OrgAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** A student's injury log. Reading needs Student view; writing needs Student manage. Health data: audited without details. */
@Service
public class StudentInjuryService {

    private final AccessService access;
    private final StudentRepository students;
    private final StudentInjuryRepository injuries;
    private final AuditService audit;

    public StudentInjuryService(AccessService access, StudentRepository students, StudentInjuryRepository injuries, AuditService audit) {
        this.access = access;
        this.students = students;
        this.injuries = injuries;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<InjuryResponse> list(UUID orgId, UUID studentId) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.VIEW);
        loadStudent(a, studentId);
        return injuries.findByStudentIdAndOrganizationIdOrderByInjuryDateDescCreatedAtDesc(studentId, orgId).stream()
                .map(StudentInjuryService::toResponse).toList();
    }

    @Transactional
    public InjuryResponse create(UUID orgId, UUID studentId, InjuryRequest req) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Student s = loadStudent(a, studentId);
        requireNotDeregistered(s);
        StudentInjury injury = new StudentInjury(orgId, studentId);
        apply(injury, req);
        injuries.save(injury);
        audit.record(orgId, a.userId(), "STUDENT_INJURY", injury.getId(), "CREATE", null);
        return toResponse(injury);
    }

    @Transactional
    public InjuryResponse update(UUID orgId, UUID studentId, UUID injuryId, InjuryRequest req) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Student s = loadStudent(a, studentId);
        requireNotDeregistered(s);
        StudentInjury injury = loadInjury(orgId, studentId, injuryId);
        apply(injury, req);
        audit.record(orgId, a.userId(), "STUDENT_INJURY", injury.getId(), "UPDATE", null);
        return toResponse(injury);
    }

    @Transactional
    public void delete(UUID orgId, UUID studentId, UUID injuryId) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Student s = loadStudent(a, studentId);
        requireNotDeregistered(s);
        StudentInjury injury = loadInjury(orgId, studentId, injuryId);
        injuries.delete(injury);
        audit.record(orgId, a.userId(), "STUDENT_INJURY", injury.getId(), "DELETE", null);
    }

    private Student loadStudent(OrgAccess a, UUID studentId) {
        Student s = students.findByIdAndOrganizationId(studentId, a.organizationId())
                .orElseThrow(() -> new NotFoundException("Student not found."));
        a.requireCenter(s.getCenterId());
        return s;
    }

    private StudentInjury loadInjury(UUID orgId, UUID studentId, UUID injuryId) {
        return injuries.findByIdAndStudentIdAndOrganizationId(injuryId, studentId, orgId)
                .orElseThrow(() -> new NotFoundException("Injury not found."));
    }

    private static void requireNotDeregistered(Student s) {
        if (s.getStatus() == StudentStatus.DEREGISTERED) {
            throw new BusinessRuleException("DEREGISTERED", "This student has been deregistered.");
        }
    }

    private static void apply(StudentInjury injury, InjuryRequest r) {
        if (r.recoveredOn() != null && r.recoveredOn().isBefore(r.injuryDate())) {
            throw new BusinessRuleException("RECOVERY_BEFORE_INJURY", "The recovery date cannot be before the injury date.");
        }
        injury.update(r.injuryDate(), Text.clean(r.bodyPart()), r.severity(), Text.clean(r.description()), r.recoveredOn());
    }

    private static InjuryResponse toResponse(StudentInjury i) {
        return new InjuryResponse(i.getId(), i.getInjuryDate(), i.getBodyPart(), i.getSeverity(), i.getDescription(), i.getRecoveredOn());
    }
}
