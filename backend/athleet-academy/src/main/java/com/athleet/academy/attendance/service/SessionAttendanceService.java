package com.athleet.academy.attendance.service;

import com.athleet.academy.attendance.domain.AttendanceConfig;
import com.athleet.academy.attendance.domain.AttendanceMark;
import com.athleet.academy.attendance.domain.AttendanceSession;
import com.athleet.academy.attendance.domain.AttendanceSessionApproved;
import com.athleet.academy.attendance.domain.MarkStatus;
import com.athleet.academy.attendance.domain.SessionAction;
import com.athleet.academy.attendance.domain.SessionStatus;
import com.athleet.academy.attendance.domain.SessionWorkflow;
import com.athleet.academy.attendance.dto.AttendanceDtos.MarkRequest;
import com.athleet.academy.attendance.dto.AttendanceDtos.MarkResponse;
import com.athleet.academy.attendance.dto.AttendanceDtos.SaveSessionRequest;
import com.athleet.academy.attendance.dto.AttendanceDtos.SessionBatch;
import com.athleet.academy.attendance.dto.AttendanceDtos.SessionDetail;
import com.athleet.academy.attendance.dto.AttendanceDtos.SessionSummary;
import com.athleet.academy.attendance.dto.AttendanceDtos.TransitionRequest;
import com.athleet.academy.attendance.repository.AttendanceMarkRepository;
import com.athleet.academy.attendance.repository.AttendanceSessionRepository;
import com.athleet.academy.center.domain.Batch;
import com.athleet.academy.center.domain.Center;
import com.athleet.academy.center.domain.ActiveStatus;
import com.athleet.academy.center.repository.BatchRepository;
import com.athleet.academy.center.repository.CenterRepository;
import com.athleet.academy.common.Text;
import com.athleet.academy.student.domain.Student;
import com.athleet.academy.student.repository.StudentRepository;
import com.athleet.core.audit.service.AuditService;
import com.athleet.core.common.error.BusinessRuleException;
import com.athleet.core.common.error.NotFoundException;
import com.athleet.core.common.paging.PageResponse;
import com.athleet.core.common.paging.Pages;
import com.athleet.core.iam.domain.AccessLevel;
import com.athleet.core.iam.domain.AppModule;
import com.athleet.core.iam.service.AccessService;
import com.athleet.core.iam.service.OrgAccess;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Student attendance per batch and date, with the coach → reviewer approval workflow.
 * <ul>
 *   <li>{@code ATTENDANCE} VIEW: read within scope. MANAGE: mark and submit (only batches the caller coaches,
 *       unless they also hold {@code ATTENDANCE_APPROVAL}).</li>
 *   <li>{@code ATTENDANCE_APPROVAL} MANAGE: approve, reject, reopen. A submitter cannot approve their own session
 *       unless they hold academy-wide (head office) scope.</li>
 * </ul>
 */
@Service
public class SessionAttendanceService {

    private static final Map<String, String> SORTS = Map.of("date", "sessionDate", "status", "status");
    private static final int MAX_RANGE_DAYS = 366;

    private final AccessService access;
    private final AttendanceSessionRepository sessions;
    private final AttendanceMarkRepository marks;
    private final BatchRepository batches;
    private final CenterRepository centers;
    private final StudentRepository students;
    private final AttendanceConfigService config;
    private final AttendanceClock clock;
    private final AuditService audit;
    private final ApplicationEventPublisher events;

    public SessionAttendanceService(AccessService access, AttendanceSessionRepository sessions, AttendanceMarkRepository marks,
                                    BatchRepository batches, CenterRepository centers, StudentRepository students,
                                    AttendanceConfigService config, AttendanceClock clock, AuditService audit,
                                    ApplicationEventPublisher events) {
        this.access = access;
        this.sessions = sessions;
        this.marks = marks;
        this.batches = batches;
        this.centers = centers;
        this.students = students;
        this.config = config;
        this.clock = clock;
        this.audit = audit;
        this.events = events;
    }

    // ---------------------------------------------------------------- reads

    /** Batches that train on {@code date}, with their session (if any). Coaches see only the batches they coach. */
    @Transactional(readOnly = true)
    public List<SessionBatch> sessionBatches(UUID orgId, LocalDate date, UUID centerId) {
        OrgAccess a = access.require(orgId, AppModule.ATTENDANCE, AccessLevel.VIEW);
        List<Center> scope = centersInScope(a, orgId, centerId);
        if (scope.isEmpty()) {
            return List.of();
        }
        boolean coachOnly = a.can(AppModule.ATTENDANCE, AccessLevel.MANAGE) && !a.can(AppModule.ATTENDANCE_APPROVAL, AccessLevel.MANAGE);
        List<Batch> scheduled = batches.scheduledOn(scope.stream().map(Center::getId).toList(), date.getDayOfWeek(), date).stream()
                .filter(b -> !coachOnly || b.getCoachUserIds().contains(a.userId())).toList();
        if (scheduled.isEmpty()) {
            return List.of();
        }
        Map<UUID, AttendanceSession> byBatch = sessions.findByBatchIdInAndSessionDate(scheduled.stream().map(Batch::getId).toList(), date)
                .stream().collect(Collectors.toMap(AttendanceSession::getBatchId, s -> s));
        Map<UUID, long[]> counts = counts(byBatch.values().stream().map(AttendanceSession::getId).toList());
        Map<UUID, String> centerNames = scope.stream().collect(Collectors.toMap(Center::getId, Center::getName));
        return scheduled.stream().map(b -> {
            AttendanceSession s = byBatch.get(b.getId());
            long[] c = s == null ? new long[3] : counts.getOrDefault(s.getId(), new long[3]);
            return new SessionBatch(b.getId(), b.getName(), b.getCenterId(), centerNames.get(b.getCenterId()),
                    s == null ? null : s.getId(), s == null ? null : s.getStatus(), c[0], c[1], c[0] + c[1] + c[2]);
        }).toList();
    }

    /** Approval queue and history. {@code statuses} empty means every status. */
    @Transactional(readOnly = true)
    public PageResponse<SessionSummary> list(UUID orgId, UUID centerId, UUID batchId, Set<SessionStatus> statuses,
                                             LocalDate from, LocalDate to, int page, int size, String sort) {
        OrgAccess a = access.require(orgId, AppModule.ATTENDANCE, AccessLevel.VIEW);
        UUID scopeCenter = centerId;
        if (!a.allCenters()) {
            if (centerId != null) a.requireCenter(centerId);
            scopeCenter = a.centerId();
        }
        LocalDate end = to == null ? clock.today().plusDays(7) : to;
        LocalDate start = from == null ? end.minusDays(37) : from;
        checkRange(start, end);
        if (batchId != null) {
            loadBatch(a, batchId, false);
        }
        Collection<SessionStatus> wanted = statuses == null || statuses.isEmpty() ? EnumSet.allOf(SessionStatus.class) : statuses;
        Page<AttendanceSession> result = sessions.search(orgId, scopeCenter, batchId, wanted, start, end,
                Pages.of(page, size, sort, SORTS, Sort.by(Sort.Direction.DESC, "sessionDate").and(Sort.by("id"))));
        List<AttendanceSession> content = result.getContent();
        Map<UUID, long[]> counts = counts(content.stream().map(AttendanceSession::getId).toList());
        Map<UUID, String> batchNames = batches.findByIdIn(content.stream().map(AttendanceSession::getBatchId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Batch::getId, Batch::getName));
        Map<UUID, String> centerNames = centers.findByIdIn(content.stream().map(AttendanceSession::getCenterId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Center::getId, Center::getName));
        return PageResponse.of(result, s -> {
            long[] c = counts.getOrDefault(s.getId(), new long[3]);
            return new SessionSummary(s.getId(), s.getVersion(), s.getCenterId(), centerNames.get(s.getCenterId()), s.getBatchId(),
                    batchNames.get(s.getBatchId()), s.getSessionDate(), s.getStatus(), c[0], c[1], c[2]);
        });
    }

    /** The session with its roster. Before the first save the status is null and every student is unmarked. */
    @Transactional(readOnly = true)
    public SessionDetail get(UUID orgId, UUID batchId, LocalDate date) {
        OrgAccess a = access.require(orgId, AppModule.ATTENDANCE, AccessLevel.VIEW);
        Batch batch = loadBatch(a, batchId, false);
        AttendanceSession s = sessions.findByBatchIdAndSessionDate(batchId, date).orElse(null);
        return detail(a, batch, s, date);
    }

    // ---------------------------------------------------------------- writes

    /** Creates the session as a draft on first save, then updates the given marks. Students not listed keep their mark. */
    @Transactional
    public SessionDetail save(UUID orgId, UUID batchId, LocalDate date, SaveSessionRequest req) {
        OrgAccess a = access.require(orgId, AppModule.ATTENDANCE, AccessLevel.MANAGE);
        Batch batch = loadBatch(a, batchId, true);
        AttendanceConfig cfg = config.forOrganization(orgId);
        AttendanceSession s = sessions.findByBatchIdAndSessionDate(batchId, date).orElse(null);
        Instant now = clock.now();
        if (s == null) {
            if (req.version() != null) {
                throw stale(null);
            }
            validateNewSession(batch, date, cfg);
            s = new AttendanceSession(orgId, batch.getCenterId(), batchId, date, a.userId());
            s.apply(SessionAction.SAVE, a.userId(), null, now);
            sessions.saveAndFlush(s);
            audit.record(orgId, a.userId(), "ATTENDANCE_SESSION", s.getId(), "CREATE", null);
        } else {
            checkVersion(s, req.version());
            SessionWorkflow.next(s.getStatus(), SessionAction.SAVE);
            if (s.getStatus() == SessionStatus.DRAFT) {
                config.checkEntryDate(cfg, date);
            }
            s.apply(SessionAction.SAVE, a.userId(), null, now);
        }
        applyMarks(s, batch, req.marks());
        sessions.flush();
        return detail(a, batch, s, date);
    }

    @Transactional
    public SessionDetail submit(UUID orgId, UUID sessionId, TransitionRequest req) {
        OrgAccess a = access.require(orgId, AppModule.ATTENDANCE, AccessLevel.MANAGE);
        AttendanceSession s = loadSession(a, sessionId);
        Batch batch = loadBatch(a, s.getBatchId(), true);
        checkVersion(s, req.version());
        SessionWorkflow.next(s.getStatus(), SessionAction.SUBMIT);
        if (s.getStatus() == SessionStatus.DRAFT) {
            config.checkEntryDate(config.forOrganization(orgId), s.getSessionDate());
        }
        List<AttendanceMark> all = ensureRoster(s, batch);
        if (all.isEmpty()) {
            throw new BusinessRuleException("EMPTY_ROSTER", "This batch has no active students to mark.");
        }
        if (all.stream().anyMatch(m -> m.getStatus() == null)) {
            throw new BusinessRuleException("INCOMPLETE", "Mark every student as present or absent before submitting.");
        }
        return finish(a, batch, s, SessionAction.SUBMIT, null, all);
    }

    @Transactional
    public SessionDetail approve(UUID orgId, UUID sessionId, TransitionRequest req) {
        OrgAccess a = access.require(orgId, AppModule.ATTENDANCE_APPROVAL, AccessLevel.MANAGE);
        AttendanceSession s = loadSession(a, sessionId);
        checkVersion(s, req.version());
        SessionWorkflow.next(s.getStatus(), SessionAction.APPROVE);
        if (a.userId().equals(s.getSubmittedBy()) && !a.allCenters()) {
            throw new BusinessRuleException("SELF_APPROVAL", "Someone else must approve attendance that you submitted.");
        }
        Batch batch = loadBatch(a, s.getBatchId(), false);
        List<AttendanceMark> all = marks.findBySessionId(s.getId());
        SessionDetail result = finish(a, batch, s, SessionAction.APPROVE, null, all);
        events.publishEvent(new AttendanceSessionApproved(orgId, s.getCenterId(), s.getBatchId(), s.getId(), s.getSessionDate(),
                a.userId(), all.stream().filter(m -> m.getStatus() == MarkStatus.ABSENT).map(AttendanceMark::getStudentId).toList()));
        return result;
    }

    @Transactional
    public SessionDetail reject(UUID orgId, UUID sessionId, TransitionRequest req) {
        return review(orgId, sessionId, req, SessionAction.REJECT);
    }

    /** Sends an approved session back for correction. */
    @Transactional
    public SessionDetail reopen(UUID orgId, UUID sessionId, TransitionRequest req) {
        return review(orgId, sessionId, req, SessionAction.REOPEN);
    }

    // ---------------------------------------------------------------- internals

    private SessionDetail review(UUID orgId, UUID sessionId, TransitionRequest req, SessionAction action) {
        OrgAccess a = access.require(orgId, AppModule.ATTENDANCE_APPROVAL, AccessLevel.MANAGE);
        AttendanceSession s = loadSession(a, sessionId);
        checkVersion(s, req.version());
        SessionWorkflow.next(s.getStatus(), action);
        String reason = Text.clean(req.reason());
        if (reason == null || reason.length() < 3) {
            throw new BusinessRuleException("REASON_REQUIRED", "Give a reason of at least 3 characters.");
        }
        Batch batch = loadBatch(a, s.getBatchId(), false);
        return finish(a, batch, s, action, reason, marks.findBySessionId(s.getId()));
    }

    private SessionDetail finish(OrgAccess a, Batch batch, AttendanceSession s, SessionAction action, String reason,
                                 List<AttendanceMark> all) {
        s.apply(action, a.userId(), reason, clock.now());
        sessions.flush();
        long present = all.stream().filter(m -> m.getStatus() == MarkStatus.PRESENT).count();
        long absent = all.stream().filter(m -> m.getStatus() == MarkStatus.ABSENT).count();
        // Counts and status only: free-text reasons and names never go to the audit log.
        audit.record(a.organizationId(), a.userId(), "ATTENDANCE_SESSION", s.getId(), action.name(),
                "status=" + s.getStatus() + " present=" + present + " absent=" + absent);
        return detail(a, batch, s, s.getSessionDate());
    }

    private void validateNewSession(Batch batch, LocalDate date, AttendanceConfig cfg) {
        if (batch.getStatus() != ActiveStatus.ACTIVE) {
            throw new BusinessRuleException("BATCH_INACTIVE", "This batch is not active.");
        }
        if ((batch.getStartDate() != null && date.isBefore(batch.getStartDate()))
                || (batch.getEndDate() != null && date.isAfter(batch.getEndDate()))) {
            throw new BusinessRuleException("OUTSIDE_BATCH_DATES", "This date is outside the batch's start and end dates.");
        }
        DayOfWeek day = date.getDayOfWeek();
        if (batch.getSlots().stream().noneMatch(sl -> sl.getDayOfWeek() == day)) {
            throw new BusinessRuleException("NOT_A_TRAINING_DAY", "This batch does not train on that day.");
        }
        config.checkEntryDate(cfg, date);
    }

    private void applyMarks(AttendanceSession s, Batch batch, List<MarkRequest> requested) {
        Map<UUID, AttendanceMark> byStudent = marks.findBySessionId(s.getId()).stream()
                .collect(Collectors.toMap(AttendanceMark::getStudentId, m -> m));
        List<Student> roster = students.activeInBatch(s.getOrganizationId(), batch.getId());
        Set<UUID> allowed = new HashSet<>(byStudent.keySet());
        roster.forEach(st -> allowed.add(st.getId()));
        Set<UUID> seen = new HashSet<>();
        for (MarkRequest m : requested) {
            if (!allowed.contains(m.studentId())) {
                throw new NotFoundException("Student not found.");
            }
            if (!seen.add(m.studentId())) {
                throw new BusinessRuleException("DUPLICATE_STUDENT", "Each student can appear only once.");
            }
        }
        List<AttendanceMark> created = new ArrayList<>();
        for (Student st : roster) {
            if (!byStudent.containsKey(st.getId())) {
                AttendanceMark m = new AttendanceMark(s.getId(), st.getId());
                byStudent.put(st.getId(), m);
                created.add(m);
            }
        }
        for (MarkRequest m : requested) {
            AttendanceMark mark = byStudent.get(m.studentId());
            mark.setStatus(m.status());
            mark.setRemark(Text.clean(m.remark()));
        }
        marks.saveAll(created);
    }

    /**
     * Existing marks plus an unmarked row for every active student who joined the batch since the last save.
     * An unmarked row of a student who has since left the roster (deactivated, deregistered, moved) is dropped, so it
     * cannot block submitting; rows that already hold a mark stay, they are part of that day's record.
     */
    private List<AttendanceMark> ensureRoster(AttendanceSession s, Batch batch) {
        List<Student> roster = students.activeInBatch(s.getOrganizationId(), batch.getId());
        Set<UUID> onRoster = roster.stream().map(Student::getId).collect(Collectors.toSet());
        List<AttendanceMark> existing = new ArrayList<>(marks.findBySessionId(s.getId()));
        List<AttendanceMark> stale = existing.stream().filter(m -> m.getStatus() == null && !onRoster.contains(m.getStudentId())).toList();
        if (!stale.isEmpty()) {
            marks.deleteAll(stale);
            existing.removeAll(stale);
        }
        Set<UUID> have = existing.stream().map(AttendanceMark::getStudentId).collect(Collectors.toSet());
        List<AttendanceMark> created = roster.stream()
                .filter(st -> !have.contains(st.getId())).map(st -> new AttendanceMark(s.getId(), st.getId())).toList();
        marks.saveAll(created);
        existing.addAll(created);
        return existing;
    }

    private SessionDetail detail(OrgAccess a, Batch batch, AttendanceSession s, LocalDate date) {
        boolean editable = s == null || s.getStatus().editable();
        List<AttendanceMark> existing = s == null ? List.of() : marks.findBySessionId(s.getId());
        Map<UUID, AttendanceMark> byStudent = existing.stream().collect(Collectors.toMap(AttendanceMark::getStudentId, m -> m));
        List<Student> roster = editable ? students.activeInBatch(a.organizationId(), batch.getId()) : List.of();
        // While the coach can still edit, an unmarked row of a student who left the roster is not shown (see ensureRoster).
        Set<UUID> ids = new HashSet<>();
        byStudent.forEach((studentId, mark) -> {
            if (!editable || mark.getStatus() != null) ids.add(studentId);
        });
        roster.forEach(st -> ids.add(st.getId()));
        // The ids come from this session's marks and this academy's roster, so no organization filter: a student who was
        // transferred to another academy must still show up in the sessions that were recorded here.
        Map<UUID, Student> people = ids.isEmpty() ? Map.of() : students.findAllById(ids).stream()
                .collect(Collectors.toMap(Student::getId, st -> st));
        List<MarkResponse> rows = people.values().stream()
                .sorted(Comparator.comparing((Student st) -> st.getFirstName().toLowerCase(Locale.ROOT)).thenComparing(Student::getId))
                .map(st -> {
                    AttendanceMark m = byStudent.get(st.getId());
                    String name = st.getLastName() == null ? st.getFirstName() : st.getFirstName() + " " + st.getLastName();
                    return new MarkResponse(st.getId(), st.getStudentNo(), name, m == null ? null : m.getStatus(),
                            m == null ? null : m.getRemark());
                }).toList();
        boolean canMark = a.can(AppModule.ATTENDANCE, AccessLevel.MANAGE) && coachOk(a, batch);
        boolean selfBlocked = s != null && a.userId().equals(s.getSubmittedBy()) && !a.allCenters();
        boolean canReview = s != null && s.getStatus().pending() && a.can(AppModule.ATTENDANCE_APPROVAL, AccessLevel.MANAGE) && !selfBlocked;
        return new SessionDetail(s == null ? null : s.getId(), s == null ? null : s.getVersion(), batch.getCenterId(), batch.getId(),
                batch.getName(), date, s == null ? null : s.getStatus(), s == null ? null : s.getReviewReason(),
                editable && canMark, editable && canMark, canReview, rows);
    }

    private Batch loadBatch(OrgAccess a, UUID batchId, boolean forMarking) {
        Batch b = batches.findByIdAndOrganizationId(batchId, a.organizationId())
                .orElseThrow(() -> new NotFoundException("Batch not found."));
        a.requireCenter(b.getCenterId());
        if (forMarking && !coachOk(a, b)) {
            throw new NotFoundException("Batch not found.");
        }
        return b;
    }

    /** Reviewers may mark any batch in scope; everyone else only batches they coach. */
    private static boolean coachOk(OrgAccess a, Batch b) {
        return a.can(AppModule.ATTENDANCE_APPROVAL, AccessLevel.MANAGE) || b.getCoachUserIds().contains(a.userId());
    }

    private AttendanceSession loadSession(OrgAccess a, UUID sessionId) {
        AttendanceSession s = sessions.findByIdAndOrganizationId(sessionId, a.organizationId())
                .orElseThrow(() -> new NotFoundException("Attendance session not found."));
        a.requireCenter(s.getCenterId());
        return s;
    }

    private List<Center> centersInScope(OrgAccess a, UUID orgId, UUID centerId) {
        if (centerId != null) {
            a.requireCenter(centerId);
        }
        return centers.findByOrganizationIdInOrderByNameAsc(List.of(orgId)).stream()
                .filter(c -> a.centerId() == null || c.getId().equals(a.centerId()))
                .filter(c -> centerId == null || c.getId().equals(centerId)).toList();
    }

    /** [present, absent, unmarked] per session. */
    private Map<UUID, long[]> counts(Collection<UUID> sessionIds) {
        Map<UUID, long[]> out = new LinkedHashMap<>();
        if (sessionIds.isEmpty()) {
            return out;
        }
        for (Object[] row : marks.countsBySession(sessionIds)) {
            long[] c = out.computeIfAbsent((UUID) row[0], k -> new long[3]);
            MarkStatus st = (MarkStatus) row[1];
            c[st == MarkStatus.PRESENT ? 0 : st == MarkStatus.ABSENT ? 1 : 2] += ((Number) row[2]).longValue();
        }
        return out;
    }

    private static void checkVersion(AttendanceSession s, Long version) {
        if (version == null || !version.equals(s.getVersion())) {
            throw stale(s);
        }
    }

    private static ObjectOptimisticLockingFailureException stale(AttendanceSession s) {
        return new ObjectOptimisticLockingFailureException(AttendanceSession.class, s == null ? "new" : s.getId());
    }

    private static void checkRange(LocalDate from, LocalDate to) {
        if (to.isBefore(from) || from.plusDays(MAX_RANGE_DAYS).isBefore(to)) {
            throw new BusinessRuleException("INVALID_RANGE", "Choose a date range of at most " + MAX_RANGE_DAYS + " days.");
        }
    }
}
