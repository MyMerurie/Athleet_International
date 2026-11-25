package com.athleet.academy.student.domain;

import com.athleet.core.common.persistence.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "student")
public class Student extends BaseEntity {

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    /** Human-readable student ID shown in the list (per organization). */
    @Column(name = "student_no", nullable = false, updatable = false)
    private long studentNo;

    @Column(name = "center_id", nullable = false)
    private UUID centerId;

    @ElementCollection
    @CollectionTable(name = "student_batch", joinColumns = @JoinColumn(name = "student_id"))
    @Column(name = "batch_id")
    private Set<UUID> batchIds = new HashSet<>();

    /** Optional login for the parent/student app. */
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "first_name", nullable = false) private String firstName;
    @Column(name = "last_name") private String lastName;
    private String email;
    @Enumerated(EnumType.STRING) private Gender gender;
    @Column(name = "date_of_birth") private LocalDate dateOfBirth;
    @Column(name = "country_code") private String countryCode;
    private String mobile;
    @Column(name = "unique_id") private String uniqueId;
    @Column(name = "blood_group") private String bloodGroup;
    private String country;
    private String state;
    private String city;
    private String address;
    @Column(name = "pin_code") private String pinCode;
    @Column(name = "school_name") private String schoolName;
    @Column(name = "school_address") private String schoolAddress;
    private String grade;
    @Enumerated(EnumType.STRING) @Column(name = "dominant_side") private DominantSide dominantSide;
    @Column(name = "medical_condition") private String medicalCondition;
    @Column(name = "kit_size") private String kitSize;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "student_id", nullable = false)
    @OrderBy("sortOrder")
    private List<StudentContact> contacts = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StudentStatus status;

    @Column(name = "deregistered_at") private Instant deregisteredAt;
    @Column(name = "deregistration_reason") private String deregistrationReason;

    protected Student() {
    }

    public Student(UUID organizationId, long studentNo, UUID centerId, String firstName, StudentStatus status) {
        this.organizationId = organizationId;
        this.studentNo = studentNo;
        this.centerId = centerId;
        this.firstName = firstName;
        this.status = status;
    }

    public void replaceBatches(Set<UUID> next) {
        batchIds.clear();
        batchIds.addAll(next);
    }

    public void replaceContacts(List<StudentContact> next) {
        contacts.clear();
        contacts.addAll(next);
    }

    public void deregister(String reason) {
        status = StudentStatus.DEREGISTERED;
        deregisteredAt = Instant.now();
        deregistrationReason = reason;
    }

    public UUID getOrganizationId() { return organizationId; }
    public long getStudentNo() { return studentNo; }
    public UUID getCenterId() { return centerId; }
    public void setCenterId(UUID centerId) { this.centerId = centerId; }
    public Set<UUID> getBatchIds() { return batchIds; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public Gender getGender() { return gender; }
    public void setGender(Gender gender) { this.gender = gender; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }
    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }
    public String getUniqueId() { return uniqueId; }
    public void setUniqueId(String uniqueId) { this.uniqueId = uniqueId; }
    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getPinCode() { return pinCode; }
    public void setPinCode(String pinCode) { this.pinCode = pinCode; }
    public String getSchoolName() { return schoolName; }
    public void setSchoolName(String schoolName) { this.schoolName = schoolName; }
    public String getSchoolAddress() { return schoolAddress; }
    public void setSchoolAddress(String schoolAddress) { this.schoolAddress = schoolAddress; }
    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }
    public DominantSide getDominantSide() { return dominantSide; }
    public void setDominantSide(DominantSide dominantSide) { this.dominantSide = dominantSide; }
    public String getMedicalCondition() { return medicalCondition; }
    public void setMedicalCondition(String medicalCondition) { this.medicalCondition = medicalCondition; }
    public String getKitSize() { return kitSize; }
    public void setKitSize(String kitSize) { this.kitSize = kitSize; }
    public List<StudentContact> getContacts() { return contacts; }
    public StudentStatus getStatus() { return status; }
    public void setStatus(StudentStatus status) { this.status = status; }
    public Instant getDeregisteredAt() { return deregisteredAt; }
    public String getDeregistrationReason() { return deregistrationReason; }
}
