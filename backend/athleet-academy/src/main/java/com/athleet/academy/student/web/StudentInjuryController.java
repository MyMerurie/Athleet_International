package com.athleet.academy.student.web;

import com.athleet.academy.student.dto.StudentDtos.InjuryRequest;
import com.athleet.academy.student.dto.StudentDtos.InjuryResponse;
import com.athleet.academy.student.service.StudentInjuryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orgs/{orgId}/students/{studentId}/injuries")
public class StudentInjuryController {

    private final StudentInjuryService injuries;

    public StudentInjuryController(StudentInjuryService injuries) {
        this.injuries = injuries;
    }

    @GetMapping
    public List<InjuryResponse> list(@PathVariable UUID orgId, @PathVariable UUID studentId) {
        return injuries.list(orgId, studentId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InjuryResponse create(@PathVariable UUID orgId, @PathVariable UUID studentId, @Valid @RequestBody InjuryRequest req) {
        return injuries.create(orgId, studentId, req);
    }

    @PutMapping("/{injuryId}")
    public InjuryResponse update(@PathVariable UUID orgId, @PathVariable UUID studentId, @PathVariable UUID injuryId,
                                 @Valid @RequestBody InjuryRequest req) {
        return injuries.update(orgId, studentId, injuryId, req);
    }

    @DeleteMapping("/{injuryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID orgId, @PathVariable UUID studentId, @PathVariable UUID injuryId) {
        injuries.delete(orgId, studentId, injuryId);
    }
}
