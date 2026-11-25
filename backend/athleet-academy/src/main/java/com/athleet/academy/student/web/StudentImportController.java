package com.athleet.academy.student.web;

import com.athleet.academy.student.dto.StudentDtos.ImportResult;
import com.athleet.academy.student.service.StudentImportService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Bulk import of students from a CSV file: download the template, check a file, import it. */
@RestController
@RequestMapping("/api/v1/orgs/{orgId}/students/import")
public class StudentImportController {

    private final StudentImportService imports;

    public StudentImportController(StudentImportService imports) {
        this.imports = imports;
    }

    @GetMapping("/template")
    public ResponseEntity<byte[]> template(@PathVariable UUID orgId) {
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("student-import-template.csv").build().toString())
                .body(imports.template(orgId));
    }

    /** {@code dryRun=true} (the default) only checks the file; {@code false} imports it when there are no errors. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportResult run(@PathVariable UUID orgId, @RequestParam("file") MultipartFile file,
                            @RequestParam(defaultValue = "true") boolean dryRun) {
        return imports.run(orgId, file, dryRun);
    }
}
