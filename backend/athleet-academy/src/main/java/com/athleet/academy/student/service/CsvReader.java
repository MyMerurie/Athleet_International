package com.athleet.academy.student.service;

import com.athleet.core.common.error.BusinessRuleException;

import java.util.ArrayList;
import java.util.List;

/**
 * A small strict CSV reader (RFC 4180): comma separated, values may be quoted, a quote inside a quoted value is doubled,
 * records end with CRLF, CR or LF, and quoted values may contain line breaks. Blank lines are skipped.
 * Limits keep a hostile file from using much memory.
 */
final class CsvReader {

    private CsvReader() {
    }

    static List<List<String>> parse(String text, int maxRecords, int maxColumns, int maxFieldLength) {
        List<List<String>> records = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean inQuotes = false;
        boolean quoted = false;
        boolean closed = false; // a quoted value has just ended: only a comma or a line break may follow
        int n = text.length();
        for (int i = 0; i < n; i++) {
            char c = text.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < n && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                        closed = true;
                    }
                } else {
                    field.append(c);
                }
            } else if (closed && c != ',' && c != '\r' && c != '\n') {
                throw invalid("A quoted value in the file has extra text after the closing quote.");
            } else if (c == '"' && field.length() == 0 && !quoted) {
                inQuotes = true;
                quoted = true;
            } else if (c == ',') {
                row.add(field.toString());
                field.setLength(0);
                quoted = false;
                closed = false;
                if (row.size() >= maxColumns) {
                    throw invalid("The file has too many columns.");
                }
            } else if (c == '\r' || c == '\n') {
                if (c == '\r' && i + 1 < n && text.charAt(i + 1) == '\n') {
                    i++;
                }
                row.add(field.toString());
                field.setLength(0);
                quoted = false;
                closed = false;
                addRecord(records, row, maxRecords);
                row = new ArrayList<>();
            } else {
                field.append(c);
            }
            if (field.length() > maxFieldLength) {
                throw invalid("A value in the file is too long.");
            }
        }
        if (inQuotes) {
            throw invalid("A quoted value in the file is never closed.");
        }
        if (field.length() > 0 || quoted || !row.isEmpty()) {
            row.add(field.toString());
            addRecord(records, row, maxRecords);
        }
        return records;
    }

    private static void addRecord(List<List<String>> records, List<String> row, int maxRecords) {
        if (row.size() == 1 && row.get(0).isBlank()) {
            return; // blank line
        }
        records.add(row);
        if (records.size() > maxRecords) {
            throw invalid("The file has too many rows.");
        }
    }

    private static BusinessRuleException invalid(String message) {
        return new BusinessRuleException("INVALID_CSV", message);
    }
}
