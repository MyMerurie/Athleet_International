package com.athleet.academy.student.service;

import com.athleet.academy.student.domain.StudentHistory;
import com.athleet.academy.student.domain.StudentHistoryEvent;
import com.athleet.academy.student.dto.StudentDtos.HistoryEventResponse;
import com.athleet.academy.student.repository.StudentHistoryRepository;
import com.athleet.core.iam.domain.AppUser;
import com.athleet.core.iam.repository.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Writes and reads a student's history. Entries are written inside the caller's transaction, like audit records. */
@Service
public class StudentHistoryService {

    private final StudentHistoryRepository history;
    private final AppUserRepository users;

    public StudentHistoryService(StudentHistoryRepository history, AppUserRepository users) {
        this.history = history;
        this.users = users;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(UUID organizationId, UUID studentId, UUID actorUserId, StudentHistoryEvent event) {
        history.save(new StudentHistory(organizationId, studentId, event, actorUserId));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordPlacementChange(UUID organizationId, UUID studentId, UUID actorUserId,
                                      String fromCenter, String fromBatches, String toCenter, String toBatches) {
        history.save(new StudentHistory(organizationId, studentId, StudentHistoryEvent.PLACEMENT_CHANGED, actorUserId)
                .placement(fromCenter, fromBatches, toCenter, toBatches));
    }

    /** Recorded under the academy the student moved to. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordTransfer(UUID targetOrganizationId, UUID studentId, UUID actorUserId,
                               String fromAcademy, String fromCenter, String fromBatches,
                               String toAcademy, String toCenter, String toBatches) {
        history.save(new StudentHistory(targetOrganizationId, studentId, StudentHistoryEvent.TRANSFERRED, actorUserId)
                .academies(fromAcademy, toAcademy)
                .placement(fromCenter, fromBatches, toCenter, toBatches));
    }

    /** Newest first. The caller has already checked access to the student. */
    @Transactional(readOnly = true)
    public List<HistoryEventResponse> list(UUID studentId) {
        List<StudentHistory> rows = history.findByStudentIdOrderByOccurredAtDescIdDesc(studentId);
        Set<UUID> actorIds = new HashSet<>();
        rows.forEach(r -> { if (r.getActorUserId() != null) actorIds.add(r.getActorUserId()); });
        Map<UUID, String> names = actorIds.isEmpty() ? Map.of() : users.findByIdIn(actorIds).stream()
                .collect(Collectors.toMap(AppUser::getId, AppUser::fullName));
        return rows.stream().map(r -> new HistoryEventResponse(r.getId(), r.getEventType(), r.getOccurredAt(),
                r.getActorUserId() == null ? null : names.get(r.getActorUserId()),
                r.getFromAcademy(), r.getToAcademy(), r.getFromCenter(), r.getToCenter(),
                r.getFromBatches(), r.getToBatches())).toList();
    }
}
