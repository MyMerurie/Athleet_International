package com.athleet.academy.student.web;

import com.athleet.academy.student.dto.StudentDtos.ApplyUniqueIdsResponse;
import com.athleet.academy.student.dto.StudentDtos.StudentConfigRequest;
import com.athleet.academy.student.dto.StudentDtos.StudentConfigResponse;
import com.athleet.academy.student.service.StudentConfigService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orgs/{orgId}/student-config")
public class StudentConfigController {

    private final StudentConfigService config;

    public StudentConfigController(StudentConfigService config) {
        this.config = config;
    }

    @GetMapping
    public StudentConfigResponse get(@PathVariable UUID orgId) {
        return config.get(orgId);
    }

    @PutMapping
    public StudentConfigResponse update(@PathVariable UUID orgId, @Valid @RequestBody StudentConfigRequest req) {
        return config.update(orgId, req);
    }

    @PostMapping("/apply")
    public ApplyUniqueIdsResponse apply(@PathVariable UUID orgId) {
        return config.applyUniqueIds(orgId);
    }
}
