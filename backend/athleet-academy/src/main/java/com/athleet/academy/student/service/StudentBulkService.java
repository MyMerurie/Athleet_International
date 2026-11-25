package com.athleet.academy.student.service;

import com.athleet.academy.common.Text;
import com.athleet.academy.student.domain.BulkAction;
import com.athleet.academy.student.domain.Student;
import com.athleet.academy.student.domain.StudentHistoryEvent;
import com.athleet.academy.student.domain.StudentStatus;
import com.athleet.academy.student.dto.StudentDtos.BulkRequest;
import com.athleet.academy.student.dto.StudentDtos.BulkResult;
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
import java.util.Set;
import java.util.UUID;

/**
 * Bulk actions on selected students (Acadware "Select Bulk Action"). All or nothing: every id must be inside the
 * caller's scope and in a status the action allows, otherwise nothing changes.
 */
@Service
public class StudentBulkService {

    private final AccessService access;
    private final StudentRepository students;
    private final StudentHistoryService history;
    private final AuditService audit;

    public StudentBulkService(AccessService access, StudentRepository students, StudentHistoryService history, AuditService audit) {
        this.access = access;
        this.students = students;
        this.history = history;
        this.audit = audit;
    }

    @Transactional
    public BulkResult bulk(UUID orgId, BulkRequest req) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        List<Student> found = students.findByOrganizationIdAndIdIn(orgId, req.studentIds());
        // Same answer for "does not exist" and "outside your class", so ids cannot be probed.
        if (found.size() != req.studentIds().size()) {
            throw new NotFoundException("Student not found.");
        }
        found.forEach(s -> a.requireCenter(s.getCenterId()));

        String reason = Text.clean(req.reason());
        if (req.action() == BulkAction.DEREGISTER && (reason == null || reason.length() < 3)) {
            throw new BusinessRuleException("REASON_REQUIRED", "Give a reason of at least 3 characters.");
        }
        Set<StudentStatus> allowed = allowedFrom(req.action());
        if (found.stream().anyMatch(s -> !allowed.contains(s.getStatus()))) {
            throw new BusinessRuleException("WRONG_STATE", "Some of the selected students cannot be " + verb(req.action())
                    + " in their current status.");
        }

        for (Student s : found) {
            switch (req.action()) {
                case DEACTIVATE -> s.setStatus(StudentStatus.INACTIVE);
                case ACTIVATE -> s.setStatus(StudentStatus.ACTIVE);
                case DEREGISTER -> s.deregister(reason);
            }
            history.record(orgId, s.getId(), a.userId(), event(req.action()));
            // The deregistration reason may contain personal details, so it never goes into the audit log.
            audit.record(orgId, a.userId(), "STUDENT", s.getId(), "BULK_" + req.action().name(), null);
        }
        return new BulkResult(found.size());
    }

    private static Set<StudentStatus> allowedFrom(BulkAction action) {
        return switch (action) {
            case DEACTIVATE -> Set.of(StudentStatus.ACTIVE);
            case ACTIVATE -> Set.of(StudentStatus.INACTIVE);
            case DEREGISTER -> Set.of(StudentStatus.ACTIVE, StudentStatus.INACTIVE, StudentStatus.SUBMITTED);
        };
    }

    private static String verb(BulkAction action) {
        return switch (action) {
            case DEACTIVATE -> "deactivated";
            case ACTIVATE -> "activated";
            case DEREGISTER -> "deregistered";
        };
    }

    private static StudentHistoryEvent event(BulkAction action) {
        return switch (action) {
            case DEACTIVATE -> StudentHistoryEvent.DEACTIVATED;
            case ACTIVATE -> StudentHistoryEvent.REACTIVATED;
            case DEREGISTER -> StudentHistoryEvent.DEREGISTERED;
        };
    }
}
