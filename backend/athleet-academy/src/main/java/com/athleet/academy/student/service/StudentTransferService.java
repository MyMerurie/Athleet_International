package com.athleet.academy.student.service;

import com.athleet.academy.center.domain.ActiveStatus;
import com.athleet.academy.center.domain.Batch;
import com.athleet.academy.center.domain.Center;
import com.athleet.academy.center.repository.BatchRepository;
import com.athleet.academy.center.repository.CenterRepository;
import com.athleet.academy.student.domain.Student;
import com.athleet.academy.student.domain.StudentStatus;
import com.athleet.academy.student.dto.StudentDtos.NamedRef;
import com.athleet.academy.student.dto.StudentDtos.TargetCenter;
import com.athleet.academy.student.dto.StudentDtos.TransferRequest;
import com.athleet.academy.student.dto.StudentDtos.TransferResult;
import com.athleet.academy.student.dto.StudentDtos.TransferTarget;
import com.athleet.academy.student.repository.StudentInjuryRepository;
import com.athleet.academy.student.repository.StudentRepository;
import com.athleet.core.audit.service.AuditService;
import com.athleet.core.common.error.BusinessRuleException;
import com.athleet.core.common.error.ConflictException;
import com.athleet.core.common.error.NotFoundException;
import com.athleet.core.iam.domain.AccessLevel;
import com.athleet.core.iam.domain.AppModule;
import com.athleet.core.iam.service.AccessService;
import com.athleet.core.iam.service.OrgAccess;
import com.athleet.core.organization.domain.Organization;
import com.athleet.core.organization.repository.OrganizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Moves a student between academies of the same group (a primary organization and its affiliates).
 * The caller needs Student manage in both academies; the student takes contacts and injuries along.
 * Past attendance stays with the academy where it was recorded.
 */
@Service
public class StudentTransferService {

    private final AccessService access;
    private final StudentRepository students;
    private final StudentService studentService;
    private final OrganizationRepository organizations;
    private final CenterRepository centers;
    private final BatchRepository batches;
    private final StudentInjuryRepository injuries;
    private final StudentHistoryService history;
    private final AuditService audit;

    public StudentTransferService(AccessService access, StudentRepository students, StudentService studentService,
                                  OrganizationRepository organizations, CenterRepository centers, BatchRepository batches,
                                  StudentInjuryRepository injuries, StudentHistoryService history, AuditService audit) {
        this.access = access;
        this.students = students;
        this.studentService = studentService;
        this.organizations = organizations;
        this.centers = centers;
        this.batches = batches;
        this.injuries = injuries;
        this.history = history;
        this.audit = audit;
    }

    /** Other academies of the group where the caller may manage students, with the classes and batches they may use. */
    @Transactional(readOnly = true)
    public List<TransferTarget> targets(UUID orgId) {
        access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Organization me = organization(orgId);
        // Only call require() after can(): a thrown exception inside this transaction would mark it rollback-only.
        Map<UUID, OrgAccess> allowed = new LinkedHashMap<>();
        for (Organization o : group(me)) {
            if (!o.getId().equals(orgId) && access.can(o.getId(), AppModule.STUDENT, AccessLevel.MANAGE)) {
                allowed.put(o.getId(), access.require(o.getId(), AppModule.STUDENT, AccessLevel.MANAGE));
            }
        }
        if (allowed.isEmpty()) return List.of();
        List<Center> allCenters = centers.findByOrganizationIdInOrderByNameAsc(allowed.keySet()).stream()
                .filter(c -> c.getStatus() == ActiveStatus.ACTIVE)
                .filter(c -> allowed.get(c.getOrganizationId()).centerId() == null
                        || allowed.get(c.getOrganizationId()).centerId().equals(c.getId()))
                .toList();
        Map<UUID, List<Batch>> batchesByCenter = allCenters.isEmpty() ? Map.of() : batches
                .findByCenterIdInOrderByNameAsc(allCenters.stream().map(Center::getId).toList()).stream()
                .filter(b -> b.getStatus() == ActiveStatus.ACTIVE)
                .collect(Collectors.groupingBy(Batch::getCenterId));
        List<TransferTarget> result = new ArrayList<>();
        for (Organization o : group(me)) {
            if (!allowed.containsKey(o.getId())) continue;
            List<TargetCenter> cs = allCenters.stream().filter(c -> c.getOrganizationId().equals(o.getId()))
                    .map(c -> new TargetCenter(c.getId(), c.getName(), batchesByCenter.getOrDefault(c.getId(), List.of()).stream()
                            .map(b -> new NamedRef(b.getId(), b.getName())).toList()))
                    .toList();
            result.add(new TransferTarget(o.getId(), o.getName(), cs));
        }
        return result;
    }

    @Transactional
    public TransferResult transfer(UUID orgId, UUID studentId, TransferRequest req) {
        OrgAccess src = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Student s = studentService.load(src, studentId);
        if (s.getStatus() != StudentStatus.ACTIVE) {
            throw new BusinessRuleException("NOT_ACTIVE", "Only active students can be transferred.");
        }
        UUID targetId = req.targetOrgId();
        if (targetId.equals(orgId)) {
            throw new BusinessRuleException("SAME_ACADEMY", "Choose a different academy.");
        }
        Organization from = organization(orgId);
        Organization to = organizations.findById(targetId).orElseThrow(() -> new NotFoundException("Academy not found."));
        if (!group(from).contains(to)) {
            throw new NotFoundException("Academy not found.");
        }
        OrgAccess tgt = access.require(targetId, AppModule.STUDENT, AccessLevel.MANAGE);
        studentService.validatePlacement(tgt, req.centerId(), req.batchIds());
        if (s.getEmail() != null
                && students.existsByOrganizationIdAndEmailIgnoreCaseAndStatusNot(targetId, s.getEmail(), StudentStatus.DEREGISTERED)) {
            throw new ConflictException("A student with this email already exists in that academy.");
        }
        if (s.getUniqueId() != null
                && students.existsByOrganizationIdAndUniqueIdIgnoreCaseAndStatusNot(targetId, s.getUniqueId(), StudentStatus.DEREGISTERED)) {
            throw new ConflictException("A student with this Unique ID already exists in that academy.");
        }

        StudentService.Placement before = studentService.placement(s);
        s.transferTo(targetId, req.centerId(), req.batchIds());
        injuries.moveToOrganization(studentId, targetId);
        StudentService.Placement after = studentService.placement(s);

        history.recordTransfer(targetId, studentId, src.userId(), from.getName(), before.center(), before.batches(),
                to.getName(), after.center(), after.batches());
        audit.record(orgId, src.userId(), "STUDENT", studentId, "TRANSFER_OUT", null);
        audit.record(targetId, src.userId(), "STUDENT", studentId, "TRANSFER_IN", null);
        return new TransferResult(targetId, studentId);
    }

    private Organization organization(UUID orgId) {
        return organizations.findById(orgId).orElseThrow(() -> new NotFoundException("Organization not found."));
    }

    /** The primary organization followed by all its affiliated academies. */
    private List<Organization> group(Organization any) {
        UUID root = any.getParentId() != null ? any.getParentId() : any.getId();
        List<Organization> group = new ArrayList<>();
        organizations.findById(root).ifPresent(group::add);
        group.addAll(organizations.findByParentIdOrderByNameAsc(root));
        return group;
    }
}
