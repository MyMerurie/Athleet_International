package com.athleet.academy.student.web;

import com.athleet.academy.student.domain.StudentStatus;
import com.athleet.academy.student.dto.StudentDtos.ChangeBatchesRequest;
import com.athleet.academy.student.dto.StudentDtos.DeregisterRequest;
import com.athleet.academy.student.dto.StudentDtos.StudentProfile;
import com.athleet.academy.student.dto.StudentDtos.StudentRequest;
import com.athleet.academy.student.dto.StudentDtos.StudentResponse;
import com.athleet.academy.student.dto.StudentDtos.StudentSummary;
import com.athleet.academy.student.service.StudentService;
import com.athleet.core.common.paging.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@Validated
@RequestMapping("/api/v1/orgs/{orgId}/students")
public class StudentController {

    private final StudentService students;

    public StudentController(StudentService students) {
        this.students = students;
    }

    @GetMapping
    public PageResponse<StudentSummary> list(@PathVariable UUID orgId,
                                             @RequestParam(required = false) StudentStatus status,
                                             @RequestParam(required = false) UUID centerId,
                                             @RequestParam(required = false) UUID batchId,
                                             @RequestParam(required = false) @Size(max = 100) String search,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "10") int size,
                                             @RequestParam(required = false) @Size(max = 30) String sort) {
        return students.list(orgId, status, centerId, batchId, search, page, size, sort);
    }

    @GetMapping("/{studentId}")
    public StudentResponse get(@PathVariable UUID orgId, @PathVariable UUID studentId) {
        return students.get(orgId, studentId);
    }

    @GetMapping("/{studentId}/profile")
    public StudentProfile profile(@PathVariable UUID orgId, @PathVariable UUID studentId) {
        return students.profile(orgId, studentId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentResponse create(@PathVariable UUID orgId, @Valid @RequestBody StudentRequest req) {
        return students.create(orgId, req);
    }

    @PutMapping("/{studentId}")
    public StudentResponse update(@PathVariable UUID orgId, @PathVariable UUID studentId, @Valid @RequestBody StudentRequest req) {
        return students.update(orgId, studentId, req);
    }

    @PutMapping("/{studentId}/batches")
    public StudentResponse changeBatches(@PathVariable UUID orgId, @PathVariable UUID studentId,
                                         @Valid @RequestBody ChangeBatchesRequest req) {
        return students.changeBatches(orgId, studentId, req);
    }

    @PostMapping("/{studentId}/approve")
    public StudentResponse approve(@PathVariable UUID orgId, @PathVariable UUID studentId) {
        return students.approve(orgId, studentId);
    }

    @PostMapping("/{studentId}/deregister")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deregister(@PathVariable UUID orgId, @PathVariable UUID studentId, @Valid @RequestBody DeregisterRequest req) {
        students.deregister(orgId, studentId, req.reason());
    }
}
