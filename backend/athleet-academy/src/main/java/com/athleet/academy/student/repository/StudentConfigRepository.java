package com.athleet.academy.student.repository;

import com.athleet.academy.student.domain.StudentConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface StudentConfigRepository extends JpaRepository<StudentConfig, UUID> {

    Optional<StudentConfig> findByOrganizationId(UUID organizationId);
}
