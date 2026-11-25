package com.athleet.academy.student.domain;

import com.athleet.core.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

/** Student settings of one organization. Nothing is stored until it is first saved; defaults apply until then. */
@Entity
@Table(name = "student_config")
public class StudentConfig extends BaseEntity {

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "unique_id_auto", nullable = false)
    private boolean uniqueIdAuto;

    @Column(name = "unique_id_prefix", nullable = false)
    private String uniqueIdPrefix = "";

    protected StudentConfig() {
    }

    public StudentConfig(UUID organizationId) {
        this.organizationId = organizationId;
    }

    public UUID getOrganizationId() { return organizationId; }
    public boolean isUniqueIdAuto() { return uniqueIdAuto; }
    public void setUniqueIdAuto(boolean uniqueIdAuto) { this.uniqueIdAuto = uniqueIdAuto; }
    public String getUniqueIdPrefix() { return uniqueIdPrefix; }
    public void setUniqueIdPrefix(String uniqueIdPrefix) { this.uniqueIdPrefix = uniqueIdPrefix; }
}
