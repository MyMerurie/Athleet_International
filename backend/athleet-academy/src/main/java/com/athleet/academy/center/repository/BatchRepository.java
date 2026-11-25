package com.athleet.academy.center.repository;

import com.athleet.academy.center.domain.Batch;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BatchRepository extends JpaRepository<Batch, UUID> {

    @EntityGraph(attributePaths = {"slots", "coachUserIds"})
    List<Batch> findByCenterIdAndOrganizationIdOrderByNameAsc(UUID centerId, UUID organizationId);

    @EntityGraph(attributePaths = {"slots", "coachUserIds"})
    Optional<Batch> findByIdAndOrganizationId(UUID id, UUID organizationId);

    List<Batch> findByIdIn(Collection<UUID> ids);

    /** Batches of several classes without their slots or coaches (for pick lists). */
    List<Batch> findByCenterIdInOrderByNameAsc(Collection<UUID> centerIds);

    boolean existsByCenterId(UUID centerId);

    boolean existsByCenterIdAndNameIgnoreCase(UUID centerId, String name);

    boolean existsByCenterIdAndNameIgnoreCaseAndIdNot(UUID centerId, String name, UUID id);

    /** Active batches of the given centers that train on {@code day} and are running on {@code date}. */
    @EntityGraph(attributePaths = {"slots", "coachUserIds"})
    @Query("""
            select distinct b from Batch b join b.slots sl
            where b.centerId in :centerIds and b.status = com.athleet.academy.center.domain.ActiveStatus.ACTIVE
              and sl.dayOfWeek = :day
              and (b.startDate is null or b.startDate <= :date) and (b.endDate is null or b.endDate >= :date)
            order by b.name
            """)
    List<Batch> scheduledOn(Collection<UUID> centerIds, java.time.DayOfWeek day, java.time.LocalDate date);

    @EntityGraph(attributePaths = {"slots", "coachUserIds"})
    List<Batch> findAllByIdIn(Collection<UUID> ids);

    /** [centerId, batchCount, capacitySum] for the given centers. */
    @Query("select b.centerId, count(b), coalesce(sum(b.capacity), 0) from Batch b where b.centerId in :centerIds group by b.centerId")
    List<Object[]> statsByCenter(Collection<UUID> centerIds);
}
