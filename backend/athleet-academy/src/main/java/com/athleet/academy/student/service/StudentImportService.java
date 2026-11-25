package com.athleet.academy.student.service;

import com.athleet.academy.center.domain.ActiveStatus;
import com.athleet.academy.center.domain.Batch;
import com.athleet.academy.center.domain.Center;
import com.athleet.academy.center.repository.BatchRepository;
import com.athleet.academy.center.repository.CenterRepository;
import com.athleet.academy.common.Text;
import com.athleet.academy.student.domain.DominantSide;
import com.athleet.academy.student.domain.Gender;
import com.athleet.academy.student.domain.StudentConfig;
import com.athleet.academy.student.dto.StudentDtos.ContactRequest;
import com.athleet.academy.student.dto.StudentDtos.ImportError;
import com.athleet.academy.student.dto.StudentDtos.ImportResult;
import com.athleet.academy.student.dto.StudentDtos.StudentRequest;
import com.athleet.academy.student.repository.StudentRepository;
import com.athleet.core.audit.service.AuditService;
import com.athleet.core.common.error.BusinessRuleException;
import com.athleet.core.iam.domain.AccessLevel;
import com.athleet.core.iam.domain.AppModule;
import com.athleet.core.iam.service.AccessService;
import com.athleet.core.iam.service.OrgAccess;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Bulk import of students from a CSV file (Acadware "bulk upload"; its file format was not captured, so the template is our own).
 * A check (dry run) and a real import run exactly the same validation; the real import only inserts when there are no
 * errors, and then inserts every row in one transaction. Row contents are never logged and never returned.
 */
@Service
public class StudentImportService {

    static final List<String> HEADERS = List.of(
            "Class", "Batch", "First Name", "Last Name", "Email", "Gender", "Date of Birth", "Country Code", "Mobile",
            "Unique ID", "Blood Group", "Kit Size", "Country", "State", "City", "Address", "Pin Code", "School Name",
            "School Address", "Grade", "Dominant Side", "Medical Condition",
            "Contact 1 Name", "Contact 1 Relationship", "Contact 1 Mobile", "Contact 1 Email");

    private static final long MAX_BYTES = 1024 * 1024;
    private static final int MAX_ROWS = 500;
    private static final int MAX_COLUMNS = 40;
    private static final int MAX_FIELD = 2000;
    private static final int MAX_ERRORS = 200;
    private static final Set<String> CONTENT_TYPES = Set.of("text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream");
    private static final DateTimeFormatter DAY_FIRST = DateTimeFormatter.ofPattern("d/M/uuuu").withResolverStyle(ResolverStyle.STRICT);
    /** Bean Validation property path (first segment) to the column the user sees. */
    private static final Map<String, String> COLUMNS = Map.ofEntries(
            Map.entry("centerId", "Class"), Map.entry("batchIds", "Batch"), Map.entry("firstName", "First Name"),
            Map.entry("lastName", "Last Name"), Map.entry("email", "Email"), Map.entry("gender", "Gender"),
            Map.entry("dateOfBirth", "Date of Birth"), Map.entry("countryCode", "Country Code"), Map.entry("mobile", "Mobile"),
            Map.entry("uniqueId", "Unique ID"), Map.entry("bloodGroup", "Blood Group"), Map.entry("kitSize", "Kit Size"),
            Map.entry("country", "Country"), Map.entry("state", "State"), Map.entry("city", "City"), Map.entry("address", "Address"),
            Map.entry("pinCode", "Pin Code"), Map.entry("schoolName", "School Name"), Map.entry("schoolAddress", "School Address"),
            Map.entry("grade", "Grade"), Map.entry("dominantSide", "Dominant Side"), Map.entry("medicalCondition", "Medical Condition"));
    private static final Map<String, String> CONTACT_COLUMNS = Map.of(
            "name", "Contact 1 Name", "relationship", "Contact 1 Relationship", "countryCode", "Contact 1 Mobile",
            "mobile", "Contact 1 Mobile", "email", "Contact 1 Email");

    private final AccessService access;
    private final StudentService studentService;
    private final StudentRepository students;
    private final StudentConfigService config;
    private final CenterRepository centers;
    private final BatchRepository batches;
    private final AuditService audit;
    private final Validator validator;

    public StudentImportService(AccessService access, StudentService studentService, StudentRepository students,
                                StudentConfigService config, CenterRepository centers, BatchRepository batches,
                                AuditService audit, Validator validator) {
        this.access = access;
        this.studentService = studentService;
        this.students = students;
        this.config = config;
        this.centers = centers;
        this.batches = batches;
        this.audit = audit;
        this.validator = validator;
    }

    /** UTF-8 with a byte order mark (so Excel reads it correctly): the header row only. */
    @Transactional(readOnly = true)
    public byte[] template(UUID orgId) {
        access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        return ("﻿" + String.join(",", HEADERS) + "\r\n").getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public ImportResult run(UUID orgId, MultipartFile file, boolean dryRun) {
        OrgAccess a = access.require(orgId, AppModule.STUDENT, AccessLevel.MANAGE);
        List<List<String>> records = CsvReader.parse(readText(file), MAX_ROWS + 1, MAX_COLUMNS, MAX_FIELD);
        if (records.isEmpty()) {
            throw new BusinessRuleException("INVALID_CSV", "The file is empty.");
        }
        List<ImportError> errors = new ArrayList<>();
        Map<String, Integer> col = header(records.get(0), errors);
        int rows = records.size() - 1;
        if (col == null) {
            return new ImportResult(dryRun, rows, 0, errors.size() >= MAX_ERRORS, errors);
        }
        if (rows == 0) {
            throw new BusinessRuleException("INVALID_CSV", "The file has a header but no students.");
        }

        Lookups lookups = lookups(orgId, a);
        boolean autoUniqueId = config.forOrganization(orgId).isUniqueIdAuto();
        List<Integer> rowNumbers = new ArrayList<>();
        List<StudentRequest> parsed = new ArrayList<>();
        for (int r = 1; r < records.size(); r++) {
            int rowNo = r + 1;
            StudentRequest req = toRequest(rowNo, records.get(r), col, lookups, autoUniqueId, errors);
            if (req != null) {
                rowNumbers.add(rowNo);
                parsed.add(req);
            }
        }
        checkDuplicates(orgId, rowNumbers, parsed, errors);
        // Duplicates are found after every row has been read, so put the problems back in file order.
        errors.sort(Comparator.comparingInt(ImportError::row));
        boolean truncated = errors.size() >= MAX_ERRORS;
        if (!errors.isEmpty() || dryRun) {
            return new ImportResult(dryRun, rows, 0, truncated, errors);
        }
        StudentConfig cfg = config.forOrganization(orgId);
        for (StudentRequest req : parsed) {
            studentService.register(a, req, cfg);
        }
        audit.record(orgId, a.userId(), "STUDENT_IMPORT", null, "IMPORT", "rows=" + parsed.size());
        return new ImportResult(false, rows, parsed.size(), false, List.of());
    }

    // ---------------------------------------------------------------- file

    private static String readText(MultipartFile file) {
        String name = file.getOriginalFilename();
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT).split(";")[0].trim();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".csv") || !CONTENT_TYPES.contains(type)) {
            throw new BusinessRuleException("INVALID_CSV", "Upload a .csv file.");
        }
        if (file.isEmpty()) {
            throw new BusinessRuleException("INVALID_CSV", "The file is empty.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BusinessRuleException("INVALID_CSV", "The file is too large. The limit is 1 MB.");
        }
        try {
            String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(file.getBytes())).toString();
            return text.startsWith("﻿") ? text.substring(1) : text;
        } catch (CharacterCodingException e) {
            throw new BusinessRuleException("INVALID_CSV", "The file must be saved as UTF-8.");
        } catch (IOException e) {
            throw new BusinessRuleException("INVALID_CSV", "The file could not be read.");
        }
    }

    /** Column name to index, or null (with errors added) when the header does not match the template. */
    private static Map<String, Integer> header(List<String> header, List<ImportError> errors) {
        Map<String, Integer> index = new HashMap<>();
        Map<String, String> canonical = HEADERS.stream().collect(Collectors.toMap(h -> h.toLowerCase(Locale.ROOT), h -> h));
        for (int i = 0; i < header.size(); i++) {
            String h = header.get(i).trim();
            String name = canonical.get(h.toLowerCase(Locale.ROOT));
            if (name == null) {
                errors.add(new ImportError(1, "Column " + (i + 1), "Unknown column. Use the template."));
            } else if (index.put(name, i) != null) {
                errors.add(new ImportError(1, name, "This column appears twice."));
            }
        }
        for (String h : HEADERS) {
            if (!index.containsKey(h)) {
                errors.add(new ImportError(1, h, "This column is missing. Use the template."));
            }
        }
        return errors.isEmpty() ? index : null;
    }

    // ---------------------------------------------------------------- rows

    private record Lookups(Map<String, Center> classes, Map<UUID, Map<String, Batch>> batchesByClass) {
    }

    /** Active classes of the caller's scope by lower-case name, and the active batches of those classes. */
    private Lookups lookups(UUID orgId, OrgAccess a) {
        Map<String, Center> classes = new HashMap<>();
        for (Center c : centers.findByOrganizationIdInOrderByNameAsc(List.of(orgId))) {
            if (c.getStatus() == ActiveStatus.ACTIVE && (a.centerId() == null || a.centerId().equals(c.getId()))) {
                classes.put(c.getName().toLowerCase(Locale.ROOT), c);
            }
        }
        Map<UUID, Map<String, Batch>> byClass = new HashMap<>();
        if (!classes.isEmpty()) {
            for (Batch b : batches.findByCenterIdInOrderByNameAsc(classes.values().stream().map(Center::getId).toList())) {
                if (b.getStatus() == ActiveStatus.ACTIVE) {
                    byClass.computeIfAbsent(b.getCenterId(), k -> new HashMap<>()).put(b.getName().toLowerCase(Locale.ROOT), b);
                }
            }
        }
        return new Lookups(classes, byClass);
    }

    private StudentRequest toRequest(int row, List<String> cells, Map<String, Integer> col, Lookups lookups, boolean autoUniqueId,
                                     List<ImportError> errors) {
        if (cells.size() > HEADERS.size()) {
            add(errors, row, "Row", "This row has more values than the template has columns.");
            return null;
        }
        Map<String, String> v = new HashMap<>();
        for (String h : HEADERS) {
            int i = col.get(h);
            v.put(h, i < cells.size() ? Text.clean(cells.get(i)) : null);
        }

        // placement
        UUID centerId = new UUID(0, 0);
        Set<UUID> batchIds = new LinkedHashSet<>(List.of(centerId));
        String cls = v.get("Class");
        if (cls == null) {
            add(errors, row, "Class", "This value is required.");
        } else {
            Center c = lookups.classes().get(cls.toLowerCase(Locale.ROOT));
            if (c == null) {
                add(errors, row, "Class", "Class not found.");
            } else {
                centerId = c.getId();
                batchIds = batchIds(row, v.get("Batch"), lookups.batchesByClass().getOrDefault(c.getId(), Map.of()), errors);
            }
        }

        Gender gender = null;
        if (v.get("Gender") != null) {
            gender = switch (v.get("Gender").toUpperCase(Locale.ROOT)) {
                case "MALE", "M" -> Gender.MALE;
                case "FEMALE", "F" -> Gender.FEMALE;
                case "OTHER" -> Gender.OTHER;
                default -> null;
            };
            if (gender == null) add(errors, row, "Gender", "Use Male, Female or Other.");
        } else {
            add(errors, row, "Gender", "This value is required.");
        }
        LocalDate dob = date(row, v.get("Date of Birth"), errors);
        DominantSide side = null;
        if (v.get("Dominant Side") != null) {
            try {
                side = DominantSide.valueOf(v.get("Dominant Side").toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                add(errors, row, "Dominant Side", "Use Left, Right or Both.");
            }
        }
        String mobile = v.get("Mobile");
        String code = v.get("Country Code") != null ? v.get("Country Code") : (mobile != null ? "+91" : null);
        String email = v.get("Email") == null ? null : v.get("Email").toLowerCase(Locale.ROOT);
        String uniqueId = autoUniqueId ? null : v.get("Unique ID");
        List<ContactRequest> contacts = List.of();
        if (Arrays.asList("Contact 1 Name", "Contact 1 Relationship", "Contact 1 Mobile", "Contact 1 Email").stream().anyMatch(h -> v.get(h) != null)) {
            String contactCode = code != null ? code : (v.get("Contact 1 Mobile") != null ? "+91" : null);
            contacts = List.of(new ContactRequest(v.get("Contact 1 Name"), v.get("Contact 1 Relationship"), contactCode,
                    v.get("Contact 1 Mobile"), v.get("Contact 1 Email") == null ? null : v.get("Contact 1 Email").toLowerCase(Locale.ROOT)));
        }
        String blood = v.get("Blood Group") == null ? null : v.get("Blood Group").toUpperCase(Locale.ROOT);
        String kit = v.get("Kit Size") == null ? null : v.get("Kit Size").toUpperCase(Locale.ROOT);

        StudentRequest req = new StudentRequest(centerId, batchIds, v.get("First Name"), v.get("Last Name"), email, gender, dob,
                code, mobile, uniqueId, blood, v.get("Country"), v.get("State"), v.get("City"), v.get("Address"), v.get("Pin Code"),
                v.get("School Name"), v.get("School Address"), v.get("Grade"), side, v.get("Medical Condition"), kit, contacts);
        for (ConstraintViolation<StudentRequest> cv : validator.validate(req)) {
            String column = column(cv.getPropertyPath().toString());
            // Gender and date were reported above when they could not be read; "must not be null" would repeat that.
            if (("Gender".equals(column) || "Date of Birth".equals(column)) && cv.getInvalidValue() == null && hasError(errors, row, column)) {
                continue;
            }
            if (("Class".equals(column) || "Batch".equals(column)) && hasError(errors, row, column)) {
                continue;
            }
            add(errors, row, column, cv.getMessage());
        }
        return req;
    }

    private static Set<UUID> batchIds(int row, String text, Map<String, Batch> inClass, List<ImportError> errors) {
        Set<UUID> ids = new LinkedHashSet<>();
        if (text == null) {
            add(errors, row, "Batch", "This value is required.");
            return new LinkedHashSet<>(List.of(new UUID(0, 0)));
        }
        for (String name : text.split(";")) {
            String n = name.trim();
            if (n.isEmpty()) continue;
            Batch b = inClass.get(n.toLowerCase(Locale.ROOT));
            if (b == null) {
                add(errors, row, "Batch", "A batch was not found in this class.");
            } else {
                ids.add(b.getId());
            }
        }
        if (ids.size() > 5) {
            add(errors, row, "Batch", "At most 5 batches.");
        }
        return ids.isEmpty() ? new LinkedHashSet<>(List.of(new UUID(0, 0))) : ids;
    }

    private static LocalDate date(int row, String text, List<ImportError> errors) {
        if (text == null) {
            add(errors, row, "Date of Birth", "This value is required.");
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(text, DAY_FIRST);
            } catch (DateTimeParseException e) {
                add(errors, row, "Date of Birth", "Use YYYY-MM-DD or DD/MM/YYYY.");
                return null;
            }
        }
    }

    /**
     * Rows that repeat an e-mail or Unique ID of an earlier row, or one the academy already uses. The academy is asked once
     * for the whole file instead of once per row.
     */
    private void checkDuplicates(UUID orgId, List<Integer> rowNumbers, List<StudentRequest> requests, List<ImportError> errors) {
        Set<String> emails = new HashSet<>();
        Set<String> uniqueIds = new HashSet<>();
        for (StudentRequest req : requests) {
            if (req.email() != null) emails.add(req.email().toLowerCase(Locale.ROOT));
            if (req.uniqueId() != null) uniqueIds.add(req.uniqueId().toLowerCase(Locale.ROOT));
        }
        Set<String> takenEmails = emails.isEmpty() ? Set.of() : new HashSet<>(students.emailsInUse(orgId, emails));
        Set<String> takenUniqueIds = uniqueIds.isEmpty() ? Set.of() : new HashSet<>(students.activeUniqueIdsIn(orgId, uniqueIds));
        Set<String> seenEmails = new HashSet<>();
        Set<String> seenUniqueIds = new HashSet<>();
        for (int i = 0; i < requests.size(); i++) {
            StudentRequest req = requests.get(i);
            int row = rowNumbers.get(i);
            if (req.email() != null) {
                String key = req.email().toLowerCase(Locale.ROOT);
                if (!seenEmails.add(key)) {
                    add(errors, row, "Email", "This email is used twice in the file.");
                } else if (takenEmails.contains(key)) {
                    add(errors, row, "Email", "A student with this email already exists.");
                }
            }
            if (req.uniqueId() != null) {
                String key = req.uniqueId().toLowerCase(Locale.ROOT);
                if (!seenUniqueIds.add(key)) {
                    add(errors, row, "Unique ID", "This Unique ID is used twice in the file.");
                } else if (takenUniqueIds.contains(key)) {
                    add(errors, row, "Unique ID", "A student with this Unique ID already exists.");
                }
            }
        }
    }

    private static String column(String path) {
        if (path.startsWith("contacts[")) {
            String leaf = path.substring(path.lastIndexOf('.') + 1);
            return CONTACT_COLUMNS.getOrDefault(leaf, "Contact 1 Name");
        }
        String root = path.contains(".") ? path.substring(0, path.indexOf('.')) : path;
        return COLUMNS.getOrDefault(root, root);
    }

    private static boolean hasError(List<ImportError> errors, int row, String column) {
        return errors.stream().anyMatch(e -> e.row() == row && e.column().equals(column));
    }

    private static void add(List<ImportError> errors, int row, String column, String message) {
        if (errors.size() < MAX_ERRORS) {
            errors.add(new ImportError(row, column, message));
        }
    }
}
