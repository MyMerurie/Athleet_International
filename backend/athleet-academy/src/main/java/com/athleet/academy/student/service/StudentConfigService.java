package com.athleet.academy.student.service;

import com.athleet.academy.student.domain.Student;
import com.athleet.academy.student.domain.StudentConfig;
import com.athleet.academy.student.dto.StudentDtos.ApplyUniqueIdsResponse;
import com.athleet.academy.student.dto.StudentDtos.StudentConfigRequest;
import com.athleet.academy.student.dto.StudentDtos.StudentConfigResponse;
import com.athleet.academy.student.repository.StudentConfigRepository;
import com.athleet.academy.student.repository.StudentRepository;
import com.athleet.core.audit.service.AuditService;
import com.athleet.core.common.error.BusinessRuleException;
import com.athleet.core.iam.domain.AccessLevel;
import com.athleet.core.iam.domain.AppModule;
import com.athleet.core.iam.service.AccessService;
import com.athleet.core.iam.service.OrgAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Student settings (Acadware Settings: "Player Unique ID Auto-generation"). */
@Service
public class StudentConfigService {

    private final AccessService access;
    private final StudentConfigRepository configs;
    private final StudentRepository students;
    private final AuditService audit;

    public StudentConfigService(AccessService access, StudentConfigRepository configs, StudentRepository students, AuditService audit) {
        this.access = access;
        this.configs = configs;
        this.students = students;
        this.audit = audit;
    }

    /** Any staff member may read it: the Add Student dialog needs to know whether the Unique ID is generated. */
    @Transactional(readOnly = true)
    public StudentConfigResponse get(UUID orgId) {
        access.resolve(orgId);
        return toResponse(forOrganization(orgId));
    }

    @Transactional
    public StudentConfigResponse update(UUID orgId, StudentConfigRequest req) {
        OrgAccess a = access.require(orgId, AppModule.SETTINGS, AccessLevel.MANAGE);
        StudentConfig c = configs.findByOrganizationId(orgId).orElseGet(() -> new StudentConfig(orgId));
        c.setUniqueIdAuto(req.uniqueIdAuto());
        c.setUniqueIdPrefix(req.uniqueIdPrefix());
        configs.save(c);
        audit.record(orgId, a.userId(), "STUDENT_CONFIG", c.getId(), "UPDATE", "uniqueIdAuto=" + c.isUniqueIdAuto());
        return toResponse(c);
    }

    /** Gives every student without a Unique ID the generated one (prefix + student number). Values already taken are skipped. */
    @Transactional
    public ApplyUniqueIdsResponse applyUniqueIds(UUID orgId) {
        OrgAccess a = access.require(orgId, AppModule.SETTINGS, AccessLevel.MANAGE);
        StudentConfig cfg = forOrganization(orgId);
        if (!cfg.isUniqueIdAuto()) {
            throw new BusinessRuleException("NOT_ENABLED", "Switch on Unique ID auto-generation and save first.");
        }
        Set<String> taken = new HashSet<>(students.uniqueIdsInUse(orgId));
        List<Student> missing = students.withoutUniqueId(orgId);
        int updated = 0;
        for (Student s : missing) {
            String id = generated(cfg, s.getStudentNo());
            if (taken.add(id.toLowerCase(Locale.ROOT))) {
                s.setUniqueId(id);
                updated++;
            }
        }
        audit.record(orgId, a.userId(), "STUDENT_CONFIG", cfg.getId(), "APPLY_UNIQUE_IDS", "updated=" + updated + " skipped=" + (missing.size() - updated));
        return new ApplyUniqueIdsResponse(updated, missing.size() - updated);
    }

    /** For other student services (they check access themselves). Defaults when the organization never saved settings. */
    @Transactional(readOnly = true)
    public StudentConfig forOrganization(UUID orgId) {
        return configs.findByOrganizationId(orgId).orElseGet(() -> new StudentConfig(orgId));
    }

    static String generated(StudentConfig cfg, long studentNo) {
        return cfg.getUniqueIdPrefix() + studentNo;
    }

    private static StudentConfigResponse toResponse(StudentConfig c) {
        return new StudentConfigResponse(c.isUniqueIdAuto(), c.getUniqueIdPrefix());
    }
}
