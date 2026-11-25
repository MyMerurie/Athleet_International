package com.athleet.academy.student.domain;

import com.athleet.core.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

/** A secondary contact (parent, guardian, relative) of a student. At most three per student. */
@Entity
@Table(name = "student_contact")
public class StudentContact extends BaseEntity {

    public static final int MAX_PER_STUDENT = 3;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(nullable = false) private String name;
    private String relationship;
    @Column(name = "country_code") private String countryCode;
    @Column(nullable = false) private String mobile;
    private String email;
    @Column(name = "sort_order", nullable = false) private int sortOrder;

    protected StudentContact() {
    }

    public StudentContact(UUID organizationId, String name, String relationship, String countryCode, String mobile,
                          String email, int sortOrder) {
        this.organizationId = organizationId;
        this.name = name;
        this.relationship = relationship;
        this.countryCode = countryCode;
        this.mobile = mobile;
        this.email = email;
        this.sortOrder = sortOrder;
    }

    void moveTo(UUID organizationId) {
        this.organizationId = organizationId;
    }

    public UUID getOrganizationId() { return organizationId; }
    public String getName() { return name; }
    public String getRelationship() { return relationship; }
    public String getCountryCode() { return countryCode; }
    public String getMobile() { return mobile; }
    public String getEmail() { return email; }
    public int getSortOrder() { return sortOrder; }
}
