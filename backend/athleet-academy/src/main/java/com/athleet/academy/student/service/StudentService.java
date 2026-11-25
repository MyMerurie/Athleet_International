package com.athleet.academy.student.service;

import com.athleet.academy.center.domain.Batch;
import com.athleet.academy.center.domain.Center;
import com.athleet.academy.center.repository.BatchRepository;
import com.athleet.academy.center.repository.CenterRepository;
import com.athleet.academy.common.Text;
import com.athleet.academy.student.domain.Student;
import com.athleet.academy.student.domain.StudentContact;
import com.athleet.academy.student.domain.StudentStatus;
import com.athleet.academy.student.dto.StudentDtos.ChangeBatchesRequest;
import com.athleet.academy.student.dto.StudentDtos.ContactRequest;
import com.athleet.academy.student.dto.StudentDtos.ContactResponse;
import com.athleet.academy.student.dto.StudentDtos.NamedRef;
import com.athleet.academy.student.dto.StudentDtos.StudentProfile;
import com.athleet.academy.student.dto.StudentDtos.StudentRequest;
import com.athleet.academy.student.dto.StudentDtos.StudentResponse;
import com.athleet.academy.student.dto.StudentDtos.StudentSummary;
import com.athleet.academy.student.dto.StudentDtos.TrainingDay;
import com.athleet.academy.student.repository.StudentRepository;
import com.athleet.core.audit.service.AuditService;
import com.athleet.core.common.error.BusinessRuleException;
import com.athleet.core.common.error.ConflictException;
import com.athleet.core.common.error.NotFoundException;
import com.athleet.core.common.paging.PageResponse;
import com.athleet.core.common.paging.Pages;
import com.athleet.core.iam.domain.AccessLevel;
import com.athleet.core.iam.domain.AppModule;
import com.athleet.core.iam.service.AccessService;
import com.athleet.core.iam.service.OrgAccess;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StudentService {

    private static final Map<String, String> SORTS = Map.of(
            "name", "firstName", "studentNo", "studentNo", "dateOfBirth", "dateOfBirth", "grade", "grade");

    private final AccessService access;
    private final StudentRepository students;
    private final CenterRepository centers;
    private final BatchRepository batches;
    private final AuditService audit;

    public StudentService(AccessService access, StudentRepository students, CenterRepository centers,
                          BatchRepository batches, AuditService audit) {
        this.access = access;
        this.students = students;
        this.centers = centers;
        this.batches = batches;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public PageResponse<StudentSummary> list(UUID orgId, StudentStatus status, UUID centerId, UUID batchId,
                                             String search, int page, int size, String sort) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.VIEW);
        UUID scopeCenter = centerId;
        if (!a.allCenters()) {
            if (centerId != null) a.requireCenter(centerId);
            scopeCenter = a.centerId();
        }
        Page<Student> result = students.search(orgId, status == null ? StudentStatus.ACTIVE : status, scopeCenter,
                batchId, Text.likePattern(search),
                Pages.of(page, size, sort, SORTS, Sort.by("firstName").and(Sort.by("id"))));
        Names names = names(result.getContent());
        return PageResponse.of(result, s -> new StudentSummary(s.getId(), s.getStudentNo(), s.getFirstName(),
                s.getLastName(), names.center(s.getCenterId()), names.batches(s.getBatchIds()), age(s.getDateOfBirth()),
                s.getGrade(), s.getEmail(), s.getStatus()));
    }

    @Transactional(readOnly = true)
    public StudentResponse get(UUID orgId, UUID studentId) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.VIEW);
        return toResponse(load(a, studentId));
    }

    /** The student plus the weekly training slots of their batches. Same access rules as {@link #get}. */
    @Transactional(readOnly = true)
    public StudentProfile profile(UUID orgId, UUID studentId) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.VIEW);
        Student s = load(a, studentId);
        List<TrainingDay> days = s.getBatchIds().isEmpty() ? List.of() : batches.findAllByIdIn(s.getBatchIds()).stream()
                .flatMap(b -> b.getSlots().stream()
                        .map(sl -> new TrainingDay(new NamedRef(b.getId(), b.getName()), sl.getDayOfWeek(), sl.getStartTime(), sl.getEndTime())))
                .sorted(Comparator.comparing(TrainingDay::day).thenComparing(TrainingDay::startTime)
                        .thenComparing(d -> d.batch().name()))
                .toList();
        return new StudentProfile(toResponse(s), days);
    }

    @Transactional
    public StudentResponse create(UUID orgId, StudentRequest req) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        validatePlacement(a, req.centerId(), req.batchIds());
        String email = normalizeEmail(req.email());
        if (email != null && students.existsByOrganizationIdAndEmailIgnoreCaseAndStatusNot(orgId, email, StudentStatus.DEREGISTERED)) {
            throw new ConflictException("A student with this email already exists.");
        }
        Student s = new Student(orgId, students.nextStudentNo(), req.centerId(), Text.clean(req.firstName()), StudentStatus.ACTIVE);
        apply(s, req);
        s.replaceBatches(req.batchIds());
        students.save(s);
        audit.record(orgId, a.userId(), "STUDENT", s.getId(), "CREATE", null);
        return toResponse(s);
    }

    @Transactional
    public StudentResponse update(UUID orgId, UUID studentId, StudentRequest req) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Student s = load(a, studentId);
        validatePlacement(a, req.centerId(), req.batchIds());
        String email = normalizeEmail(req.email());
        if (email != null && !email.equalsIgnoreCase(s.getEmail())
                && students.existsByOrganizationIdAndEmailIgnoreCaseAndStatusNot(orgId, email, StudentStatus.DEREGISTERED)) {
            throw new ConflictException("A student with this email already exists.");
        }
        s.setFirstName(Text.clean(req.firstName()));
        s.setCenterId(req.centerId());
        s.replaceBatches(req.batchIds());
        apply(s, req);
        audit.record(orgId, a.userId(), "STUDENT", s.getId(), "UPDATE", null);
        return toResponse(s);
    }

    /** Acadware "Batches" / "Transfer Student": move the student to other batches, possibly in another class. */
    @Transactional
    public StudentResponse changeBatches(UUID orgId, UUID studentId, ChangeBatchesRequest req) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Student s = load(a, studentId);
        requireNotDeregistered(s);
        validatePlacement(a, req.centerId(), req.batchIds());
        s.setCenterId(req.centerId());
        s.replaceBatches(req.batchIds());
        audit.record(orgId, a.userId(), "STUDENT", s.getId(), "CHANGE_BATCHES", null);
        return toResponse(s);
    }

    /** Approves a self-registered (Submitted) student. */
    @Transactional
    public StudentResponse approve(UUID orgId, UUID studentId) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Student s = load(a, studentId);
        if (s.getStatus() != StudentStatus.SUBMITTED) {
            throw new BusinessRuleException("NOT_SUBMITTED", "Only submitted registrations can be approved.");
        }
        s.setStatus(StudentStatus.ACTIVE);
        audit.record(orgId, a.userId(), "STUDENT", s.getId(), "APPROVE", null);
        return toResponse(s);
    }

    @Transactional
    public void deregister(UUID orgId, UUID studentId, String reason) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        Student s = load(a, studentId);
        requireNotDeregistered(s);
        s.deregister(Text.clean(reason));
        // The reason may contain personal details, so it is not copied into the audit log.
        audit.record(orgId, a.userId(), "STUDENT", s.getId(), "DEREGISTER", null);
    }

    private Student load(OrgAccess a, UUID studentId) {
        Student s = students.findByIdAndOrganizationId(studentId, a.organizationId())
                .orElseThrow(() -> new NotFoundException("Student not found."));
        a.requireCenter(s.getCenterId());
        return s;
    }

    private static void requireNotDeregistered(Student s) {
        if (s.getStatus() == StudentStatus.DEREGISTERED) {
            throw new BusinessRuleException("DEREGISTERED", "This student has been deregistered.");
        }
    }

    /** The class must belong to this organization (and the caller's center); every batch must belong to that class. */
    private void validatePlacement(OrgAccess a, UUID centerId, Set<UUID> batchIds) {
        a.requireCenter(centerId);
        if (!centers.existsByIdAndOrganizationId(centerId, a.organizationId())) {
            throw new NotFoundException("Class not found.");
        }
        List<Batch> found = batches.findByIdIn(batchIds);
        if (found.size() != batchIds.size()
                || found.stream().anyMatch(b -> !b.getCenterId().equals(centerId) || !b.getOrganizationId().equals(a.organizationId()))) {
            throw new BusinessRuleException("INVALID_BATCH", "Choose batches that belong to the selected class.");
        }
    }

    private static void apply(Student s, StudentRequest r) {
        s.setLastName(Text.clean(r.lastName()));
        s.setEmail(normalizeEmail(r.email()));
        s.setGender(r.gender());
        s.setDateOfBirth(r.dateOfBirth());
        s.setCountryCode(Text.clean(r.countryCode()));
        s.setMobile(Text.clean(r.mobile()));
        s.setUniqueId(Text.clean(r.uniqueId()));
        s.setBloodGroup(Text.clean(r.bloodGroup()));
        s.setCountry(Text.clean(r.country()));
        s.setState(Text.clean(r.state()));
        s.setCity(Text.clean(r.city()));
        s.setAddress(Text.clean(r.address()));
        s.setPinCode(Text.clean(r.pinCode()));
        s.setSchoolName(Text.clean(r.schoolName()));
        s.setSchoolAddress(Text.clean(r.schoolAddress()));
        s.setGrade(Text.clean(r.grade()));
        s.setDominantSide(r.dominantSide());
        s.setMedicalCondition(Text.clean(r.medicalCondition()));
        s.setKitSize(Text.clean(r.kitSize()));
        if (r.contacts() != null) {
            List<StudentContact> next = new ArrayList<>();
            for (ContactRequest c : r.contacts()) {
                next.add(new StudentContact(s.getOrganizationId(), Text.clean(c.name()), Text.clean(c.relationship()),
                        Text.clean(c.countryCode()), Text.clean(c.mobile()), normalizeEmail(c.email()), next.size()));
            }
            s.replaceContacts(next);
        }
    }

    private static String normalizeEmail(String email) {
        String e = Text.clean(email);
        return e == null ? null : e.toLowerCase(Locale.ROOT);
    }

    static Integer age(LocalDate dob) {
        return dob == null ? null : Period.between(dob, LocalDate.now(ZoneOffset.UTC)).getYears();
    }

    private StudentResponse toResponse(Student s) {
        Names n = names(List.of(s));
        return new StudentResponse(s.getId(), s.getStudentNo(), n.center(s.getCenterId()), n.batches(s.getBatchIds()),
                s.getFirstName(), s.getLastName(), s.getEmail(), s.getGender(), s.getDateOfBirth(), age(s.getDateOfBirth()),
                s.getCountryCode(), s.getMobile(), s.getUniqueId(), s.getBloodGroup(), s.getCountry(), s.getState(),
                s.getCity(), s.getAddress(), s.getPinCode(), s.getSchoolName(), s.getSchoolAddress(), s.getGrade(),
                s.getDominantSide(), s.getMedicalCondition(), s.getKitSize(),
                s.getContacts().stream().map(c -> new ContactResponse(c.getName(), c.getRelationship(), c.getCountryCode(),
                        c.getMobile(), c.getEmail())).toList(),
                s.getStatus());
    }

    /** Resolves class and batch names for a page of students with two queries. */
    private Names names(Collection<Student> list) {
        Set<UUID> centerIds = list.stream().map(Student::getCenterId).collect(Collectors.toSet());
        Set<UUID> batchIds = new HashSet<>();
        list.forEach(s -> batchIds.addAll(s.getBatchIds()));
        Map<UUID, String> c = centerIds.isEmpty() ? Map.of() : centers.findByIdIn(centerIds).stream()
                .collect(Collectors.toMap(Center::getId, Center::getName));
        Map<UUID, String> b = batchIds.isEmpty() ? Map.of() : batches.findByIdIn(batchIds).stream()
                .collect(Collectors.toMap(Batch::getId, Batch::getName));
        return new Names(c, b);
    }

    private record Names(Map<UUID, String> centers, Map<UUID, String> batches) {
        NamedRef center(UUID id) {
            return new NamedRef(id, centers.getOrDefault(id, ""));
        }

        List<NamedRef> batches(Set<UUID> ids) {
            return ids.stream().map(id -> new NamedRef(id, batches.getOrDefault(id, "")))
                    .sorted(Comparator.comparing(NamedRef::name)).toList();
        }
    }
}
