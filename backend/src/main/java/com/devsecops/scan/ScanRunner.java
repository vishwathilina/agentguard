package com.devsecops.scan;

import com.devsecops.model.ScanToolRun;
import com.devsecops.model.Vulnerability;
import com.devsecops.model.enums.ToolName;

import java.util.List;

public interface ScanRunner {

    ToolName getToolName();

    List<Vulnerability> run(ScanToolRun toolRun, ScanContext context);
}
