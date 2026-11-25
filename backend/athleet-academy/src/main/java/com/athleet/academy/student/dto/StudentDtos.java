package com.athleet.academy.student.dto;

import com.athleet.academy.student.domain.BulkAction;
import com.athleet.academy.student.domain.DominantSide;
import com.athleet.academy.student.domain.Gender;
import com.athleet.academy.student.domain.InjurySeverity;
import com.athleet.academy.student.domain.StudentHistoryEvent;
import com.athleet.academy.student.domain.StudentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class StudentDtos {

    private StudentDtos() {
    }

    private static final String NAME = "^[\\p{L}][\\p{L} .'-]*$";
    private static final String TEXT = "^[\\p{L}\\p{N} .,'&()/#:-]*$";

    /** Fields match Acadware's Add Student form. */
    public record StudentRequest(
            @NotNull UUID centerId,
            @NotEmpty @Size(max = 5) Set<UUID> batchIds,
            @NotBlank @Size(max = 60) @Pattern(regexp = NAME, message = "letters only") String firstName,
            @Size(max = 60) @Pattern(regexp = "^[\\p{L} .'-]*$", message = "letters only") String lastName,
            @Email @Size(max = 254) String email,
            @NotNull Gender gender,
            @NotNull @Past LocalDate dateOfBirth,
            @Pattern(regexp = "^\\+?\\d{1,4}$", message = "invalid country code") String countryCode,
            @Pattern(regexp = "^\\d{6,15}$", message = "must be 6-15 digits") String mobile,
            @Size(max = 40) @Pattern(regexp = "^[A-Za-z0-9/-]*$", message = "letters, digits, / and - only") String uniqueId,
            @Pattern(regexp = "^(A|B|AB|O)[+-]$|^$", message = "invalid blood group") String bloodGroup,
            @Size(max = 100) @Pattern(regexp = TEXT, message = "contains invalid characters") String country,
            @Size(max = 100) @Pattern(regexp = TEXT, message = "contains invalid characters") String state,
            @Size(max = 100) @Pattern(regexp = TEXT, message = "contains invalid characters") String city,
            @Size(max = 300) String address,
            @Pattern(regexp = "^[A-Za-z0-9 -]{0,12}$", message = "invalid pin code") String pinCode,
            @Size(max = 150) @Pattern(regexp = TEXT, message = "contains invalid characters") String schoolName,
            @Size(max = 300) String schoolAddress,
            @Size(max = 20) @Pattern(regexp = TEXT, message = "contains invalid characters") String grade,
            DominantSide dominantSide,
            @Size(max = 1000) String medicalCondition,
            @Pattern(regexp = "^(YS|YM|YL|S|M|L|XL|XXL)?$", message = "invalid kit size") String kitSize,
            /** Null leaves the contacts as they are; a list (possibly empty) replaces them. */
            @Valid @Size(max = 3, message = "at most 3 contacts") List<ContactRequest> contacts) {
    }

    public record ContactRequest(
            @NotBlank @Size(max = 120) @Pattern(regexp = NAME, message = "letters only") String name,
            @Size(max = 40) @Pattern(regexp = "^[\\p{L} .'-]*$", message = "letters only") String relationship,
            @Pattern(regexp = "^\\+?\\d{1,4}$", message = "invalid country code") String countryCode,
            @NotBlank @Pattern(regexp = "^\\d{6,15}$", message = "must be 6-15 digits") String mobile,
            @Email @Size(max = 254) String email) {
    }

    public record ContactResponse(String name, String relationship, String countryCode, String mobile, String email) {
    }

    /** Replaces all tags of a student. Blank and duplicate (case-insensitive) names are dropped by the service. */
    public record TagsRequest(
            @NotNull @Size(max = 10, message = "at most 10 tags")
            List<@NotBlank @Size(max = 30, message = "at most 30 characters")
                 @Pattern(regexp = "^[\\p{L}\\p{N} ._&/-]+$", message = "contains invalid characters") String> tags) {
    }

    public record InjuryRequest(
            @NotNull @PastOrPresent LocalDate injuryDate,
            @NotBlank @Size(max = 60) @Pattern(regexp = TEXT, message = "contains invalid characters") String bodyPart,
            @NotNull InjurySeverity severity,
            @Size(max = 1000) String description,
            @PastOrPresent LocalDate recoveredOn) {
    }

    public record InjuryResponse(UUID id, LocalDate injuryDate, String bodyPart, InjurySeverity severity,
                                 String description, LocalDate recoveredOn) {
    }

    /** Applies one action to 1-100 selected students, all or nothing. A reason is required to deregister. */
    public record BulkRequest(@NotNull BulkAction action, @NotEmpty @Size(max = 100) Set<UUID> studentIds,
                              @Size(max = 500) String reason) {
    }

    public record BulkResult(int updated) {
    }

    /** One problem found in an import file. Row 1 is the header row; the first student is row 2. Never contains the row's data. */
    public record ImportError(int row, String column, String message) {
    }

    /** Result of checking (dryRun) or importing a file. {@code imported} is 0 for a check or when errors were found. */
    public record ImportResult(boolean dryRun, int rows, int imported, boolean errorsTruncated, List<ImportError> errors) {
    }

    public record StudentConfigRequest(
            boolean uniqueIdAuto,
            @NotNull @Pattern(regexp = "^[A-Z0-9-]{0,10}$", message = "up to 10 capital letters, digits or -") String uniqueIdPrefix) {
    }

    public record StudentConfigResponse(boolean uniqueIdAuto, String uniqueIdPrefix) {
    }

    /** How many students got a generated Unique ID, and how many were skipped because that value was already taken. */
    public record ApplyUniqueIdsResponse(int updated, int skipped) {
    }

    public record TransferRequest(@NotNull UUID targetOrgId, @NotNull UUID centerId, @NotEmpty @Size(max = 5) Set<UUID> batchIds) {
    }

    /** After a transfer the student belongs to the target academy. */
    public record TransferResult(UUID organizationId, UUID studentId) {
    }

    /** An academy the caller may transfer students to, with the classes and batches they may place them in. */
    public record TransferTarget(UUID id, String name, List<TargetCenter> centers) {
    }

    public record TargetCenter(UUID id, String name, List<NamedRef> batches) {
    }

    /** One history entry; the from/to fields are name snapshots and only set for placement changes and transfers. */
    public record HistoryEventResponse(UUID id, StudentHistoryEvent eventType, Instant occurredAt, String actorName,
                                       String fromAcademy, String toAcademy, String fromCenter, String toCenter,
                                       String fromBatches, String toBatches) {
    }

    /** One weekly training slot of one of the student's batches. */
    public record TrainingDay(NamedRef batch, DayOfWeek day, LocalTime startTime, LocalTime endTime) {
    }

    public record StudentProfile(StudentResponse student, List<TrainingDay> trainingDays) {
    }

    public record DeregisterRequest(@NotBlank @Size(max = 500) String reason) {
    }

    public record ChangeBatchesRequest(@NotNull UUID centerId, @NotEmpty @Size(max = 5) Set<UUID> batchIds) {
    }

    public record NamedRef(UUID id, String name) {
    }

    /** Row in the student list (Acadware columns: Student Name, ID, Class Name, Batch, Age, Grade, Email Address). */
    public record StudentSummary(UUID id, long studentNo, String firstName, String lastName, NamedRef center,
                                 List<NamedRef> batches, Integer age, String grade, String email, StudentStatus status) {
    }

    public record StudentResponse(UUID id, long studentNo, NamedRef center, List<NamedRef> batches,
                                  String firstName, String lastName, String email, Gender gender, LocalDate dateOfBirth,
                                  Integer age, String countryCode, String mobile, String uniqueId, String bloodGroup,
                                  String country, String state, String city, String address, String pinCode,
                                  String schoolName, String schoolAddress, String grade, DominantSide dominantSide,
                                  String medicalCondition, String kitSize, List<ContactResponse> contacts,
                                  List<String> tags, StudentStatus status) {
    }
}
