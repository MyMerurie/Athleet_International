package com.athleet.academy.student.repository;

import com.athleet.academy.student.domain.StudentInjury;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudentInjuryRepository extends JpaRepository<StudentInjury, UUID> {

    List<StudentInjury> findByStudentIdAndOrganizationIdOrderByInjuryDateDescCreatedAtDesc(UUID studentId, UUID organizationId);

    Optional<StudentInjury> findByIdAndStudentIdAndOrganizationId(UUID id, UUID studentId, UUID organizationId);

    /** A transferred student takes their injury log along. */
    @Modifying(flushAutomatically = true)
    @Query("update StudentInjury i set i.organizationId = :organizationId where i.studentId = :studentId")
    int moveToOrganization(UUID studentId, UUID organizationId);
}
