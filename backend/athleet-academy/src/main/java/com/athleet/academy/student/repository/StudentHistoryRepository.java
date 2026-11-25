package com.athleet.academy.student.repository;

import com.athleet.academy.student.domain.StudentHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StudentHistoryRepository extends JpaRepository<StudentHistory, UUID> {

    /** Callers have already loaded the student inside their access scope, so the student id is the scope here. */
    List<StudentHistory> findByStudentIdOrderByOccurredAtDescIdDesc(UUID studentId);
}
