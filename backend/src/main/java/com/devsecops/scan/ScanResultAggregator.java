package com.devsecops.scan;

import com.devsecops.model.Vulnerability;
import com.devsecops.model.enums.Severity;
import com.devsecops.model.enums.VulnStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
public class ScanResultAggregator {

    public List<Vulnerability> aggregate(List<Vulnerability> rawFindings) {
        Map<String, Vulnerability> deduped = new LinkedHashMap<>();

        for (Vulnerability finding : rawFindings) {
            Vulnerability normalized = normalize(finding);
            deduped.merge(dedupeKey(normalized), normalized, this::keepHigherSeverity);
        }

        log.debug("Aggregated {} raw findings into {} unique vulnerabilities",
                rawFindings.size(), deduped.size());
        return new ArrayList<>(deduped.values());
    }

    private Vulnerability normalize(Vulnerability v) {
        if (v.getSeverity() == null) {
            v.setSeverity(Severity.INFO);
        }
        if (v.getStatus() == null) {
            v.setStatus(VulnStatus.OPEN);
        }
        if (StringUtils.hasText(v.getTitle())) {
            v.setTitle(v.getTitle().trim());
        } else {
            v.setTitle("Untitled finding");
        }
        if (v.getLineNumber() != null && v.getLineNumber() <= 0) {
            v.setLineNumber(null);
        }
        return v;
    }

    private String dedupeKey(Vulnerability v) {
        return String.join("|",
                Objects.toString(v.getToolSource(), ""),
                Objects.toString(v.getCveId(), "").toUpperCase(Locale.ROOT),
                v.getTitle().toLowerCase(Locale.ROOT),
                Objects.toString(v.getFilePath(), ""),
                Objects.toString(v.getLineNumber(), ""),
                Objects.toString(v.getAffectedComponent(), "")
        );
    }

    private Vulnerability keepHigherSeverity(Vulnerability left, Vulnerability right) {
        return severityRank(left.getSeverity()) >= severityRank(right.getSeverity()) ? left : right;
    }

    private int severityRank(Severity severity) {
        return switch (severity) {
            case CRITICAL -> 5;
            case HIGH     -> 4;
            case MEDIUM   -> 3;
            case LOW      -> 2;
            case INFO     -> 1;
        };
    }
}
