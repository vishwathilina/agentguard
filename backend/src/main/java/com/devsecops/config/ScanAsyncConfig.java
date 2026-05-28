package com.devsecops.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class ScanAsyncConfig {

    @Bean(name = "scanTaskExecutor")
    public Executor scanTaskExecutor(
            @Value("${app.scan.max-concurrent-scans:5}") int maxConcurrentScans) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(maxConcurrentScans);
        executor.setMaxPoolSize(maxConcurrentScans);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("scan-");
        executor.initialize();
        return executor;
    }

    /**
     * Separate thread pool for AI analysis so it never blocks or starves scan threads.
     * AI calls can take minutes; keeping them isolated prevents scan completion delays.
     */
    @Bean(name = "aiTaskExecutor")
    public Executor aiTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(3);
        executor.setMaxPoolSize(3);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("ai-");
        executor.initialize();
        return executor;
    }
}
