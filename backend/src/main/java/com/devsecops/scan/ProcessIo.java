package com.devsecops.scan;

import java.io.IOException;
import java.io.InputStream;

/** Bounded reads from scanner subprocess stdout to avoid OOM on huge JSON logs. */
public final class ProcessIo {

    /** 8 MiB — enough for typical Trivy/npm JSON; caps runaway output. */
    public static final int MAX_SCANNER_OUTPUT_BYTES = 8 * 1024 * 1024;

    private ProcessIo() {}

    public static String readUtf8(InputStream in) throws IOException {
        return readUtf8(in, MAX_SCANNER_OUTPUT_BYTES);
    }

    public static String readUtf8(InputStream in, int maxBytes) throws IOException {
        byte[] buf = in.readNBytes(maxBytes + 1);
        if (buf.length > maxBytes) {
            return new String(buf, 0, maxBytes, java.nio.charset.StandardCharsets.UTF_8)
                + "\n…[output truncated]";
        }
        return new String(buf, java.nio.charset.StandardCharsets.UTF_8);
    }

    /** Store at most this many chars in DB for debugging failed runs. */
    public static String truncateForStorage(String text, int maxChars) {
        if (text == null) return null;
        if (text.length() <= maxChars) return text;
        return text.substring(0, maxChars) + "…[truncated]";
    }
}
