package com.athleet.academy.student.repository;

import com.athleet.academy.student.domain.Student;
import com.athleet.academy.student.domain.StudentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface StudentRepository extends JpaRepository<Student, UUID> {

    @EntityGraph(attributePaths = "batchIds")
    Optional<Student> findByIdAndOrganizationId(UUID id, UUID organizationId);

    // No entity graph here: fetching a collection with paging would page in memory. Batch ids load via batch fetching.
    @Query("""
            select s from Student s where s.organizationId = :orgId and s.status = :status
              and (:centerId is null or s.centerId = :centerId)
              and (:batchId is null or :batchId member of s.batchIds)
              and (:search is null
                   or lower(concat(s.firstName, ' ', coalesce(s.lastName, ''))) like :search
                   or lower(coalesce(s.email, '')) like :search
                   or coalesce(s.mobile, '') like :search
                   or cast(s.studentNo as string) like :search)
            """)
    Page<Student> search(UUID orgId, StudentStatus status, UUID centerId, UUID batchId, String search, Pageable pageable);

    /** Roster of a batch for attendance: students currently active in it. */
    @Query("""
            select s from Student s where s.organizationId = :orgId and :batchId member of s.batchIds
              and s.status = com.athleet.academy.student.domain.StudentStatus.ACTIVE
            order by s.firstName, s.lastName, s.id
            """)
    List<Student> activeInBatch(UUID orgId, UUID batchId);

    List<Student> findByOrganizationIdAndIdIn(UUID organizationId, Collection<UUID> ids);

    boolean existsByCenterId(UUID centerId);

    @Query("select count(s) > 0 from Student s where :batchId member of s.batchIds and s.status <> com.athleet.academy.student.domain.StudentStatus.DEREGISTERED")
    boolean existsByBatchId(UUID batchId);

    @Query(value = "select nextval('student_no_seq')", nativeQuery = true)
    long nextStudentNo();

    boolean existsByOrganizationIdAndEmailIgnoreCaseAndStatusNot(UUID orgId, String email, StudentStatus status);

    boolean existsByOrganizationIdAndUniqueIdIgnoreCaseAndStatusNot(UUID orgId, String uniqueId, StudentStatus status);

    /** Students that still need a generated Unique ID. */
    @Query("select s from Student s where s.organizationId = :orgId and s.uniqueId is null and s.status <> com.athleet.academy.student.domain.StudentStatus.DEREGISTERED order by s.studentNo")
    List<Student> withoutUniqueId(UUID orgId);

    /** Lower-cased Unique IDs in use, so generated ones never collide with hand-typed ones. */
    @Query("select lower(s.uniqueId) from Student s where s.organizationId = :orgId and s.uniqueId is not null")
    List<String> uniqueIdsInUse(UUID orgId);

    @Query("select s.centerId, count(s) from Student s where s.centerId in :centerIds and s.status = com.athleet.academy.student.domain.StudentStatus.ACTIVE group by s.centerId")
    List<Object[]> activeCountByCenterRows(Collection<UUID> centerIds);

    default Map<UUID, Long> activeCountByCenter(Collection<UUID> centerIds) {
        return toMap(activeCountByCenterRows(centerIds));
    }

    @Query("select b, count(s) from Student s join s.batchIds b where b in :batchIds and s.status = com.athleet.academy.student.domain.StudentStatus.ACTIVE group by b")
    List<Object[]> activeCountByBatchRows(Collection<UUID> batchIds);

    default Map<UUID, Long> activeCountByBatch(Collection<UUID> batchIds) {
        return toMap(activeCountByBatchRows(batchIds));
    }

    // ---- dashboard aggregates (always scoped by organization ids and optional center) ----

    @Query("""
            select s.organizationId, s.centerId, s.gender, count(s) from Student s
            where s.organizationId in :orgIds and s.status = com.athleet.academy.student.domain.StudentStatus.ACTIVE and (:centerId is null or s.centerId = :centerId)
            group by s.organizationId, s.centerId, s.gender
            """)
    List<Object[]> headcountRows(Collection<UUID> orgIds, UUID centerId);

    @Query("""
            select s.dateOfBirth from Student s
            where s.organizationId in :orgIds and s.status = com.athleet.academy.student.domain.StudentStatus.ACTIVE and (:centerId is null or s.centerId = :centerId)
              and s.dateOfBirth is not null
            """)
    List<LocalDate> birthDates(Collection<UUID> orgIds, UUID centerId);

    private static Map<UUID, Long> toMap(List<Object[]> rows) {
        Map<UUID, Long> m = new HashMap<>();
        for (Object[] r : rows) m.put((UUID) r[0], ((Number) r[1]).longValue());
        return m;
    }
}
