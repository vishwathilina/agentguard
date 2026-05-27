package com.devsecops.scan;

import com.devsecops.model.enums.TargetType;

import java.nio.file.Path;

/**
 * Runtime context passed to each security scanner runner.
 */
public record ScanContext(
        Path workspace,
        Path sourceRoot,
        String target,
        TargetType targetType
) {
    /** Docker mount path for {@link #sourceRoot} inside containers. */
    public String containerSourcePath() {
        if (targetType == TargetType.GIT_REPO) {
            return "/workspace/repo";
        }
        return "/workspace";
    }
}
