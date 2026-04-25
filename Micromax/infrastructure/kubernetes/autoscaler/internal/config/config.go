package config

import (
    "fmt"
    "os"
    "strconv"
    "strings"
    "time"
)

type Config struct {
    TargetNamespace     string
    TargetDeployment    string
    PollInterval        time.Duration
    MetricsTimeout      time.Duration
    MetricsEndpoints    []string
    MinReplicas         int32
    MaxReplicas         int32
    ScaleUpStep         int32
    ScaleDownStep       int32
    QueueDepthThreshold int64
    ProcessingTargetMs  int64
    LatencyTargetMs     int64
    ScaleUpCooldown     time.Duration
    ScaleDownCooldown   time.Duration
    StabilizationWindow time.Duration
}

func FromEnv() (Config, error) {
    cfg := Config{
        TargetNamespace:     getenv("TARGET_NAMESPACE", "micromax"),
        TargetDeployment:    getenv("TARGET_DEPLOYMENT", "regional-exchange-adapter"),
        PollInterval:        mustDuration("POLL_INTERVAL", "5s"),
        MetricsTimeout:      mustDuration("METRICS_TIMEOUT", "1500ms"),
        MetricsEndpoints:    splitCSV(getenv("METRICS_ENDPOINTS", "http://signal-processor.micromax.svc.cluster.local:8080/internal/volatility,http://trade-executor.micromax.svc.cluster.local:8080/internal/volatility")),
        MinReplicas:         int32(mustInt("MIN_REPLICAS", 3)),
        MaxReplicas:         int32(mustInt("MAX_REPLICAS", 30)),
        ScaleUpStep:         int32(mustInt("SCALE_UP_STEP", 4)),
        ScaleDownStep:       int32(mustInt("SCALE_DOWN_STEP", 1)),
        QueueDepthThreshold: mustInt64("QUEUE_DEPTH_THRESHOLD", 2000),
        ProcessingTargetMs:  mustInt64("PROCESSING_TARGET_MS", 10),
        LatencyTargetMs:     mustInt64("WEBSOCKET_LATENCY_TARGET_MS", 15),
        ScaleUpCooldown:     mustDuration("SCALE_UP_COOLDOWN", "15s"),
        ScaleDownCooldown:   mustDuration("SCALE_DOWN_COOLDOWN", "90s"),
        StabilizationWindow: mustDuration("STABILIZATION_WINDOW", "30s"),
    }

    if cfg.TargetNamespace == "" || cfg.TargetDeployment == "" {
        return Config{}, fmt.Errorf("target namespace and deployment are required")
    }

    if len(cfg.MetricsEndpoints) == 0 {
        return Config{}, fmt.Errorf("at least one metrics endpoint is required")
    }

    if cfg.MinReplicas < 1 {
        return Config{}, fmt.Errorf("min replicas must be >= 1")
    }

    if cfg.MaxReplicas < cfg.MinReplicas {
        return Config{}, fmt.Errorf("max replicas must be >= min replicas")
    }

    return cfg, nil
}

func getenv(key, fallback string) string {
    if value, ok := os.LookupEnv(key); ok {
        return strings.TrimSpace(value)
    }
    return fallback
}

func mustInt(key string, fallback int) int {
    if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
        parsed, err := strconv.Atoi(strings.TrimSpace(value))
        if err == nil {
            return parsed
        }
    }
    return fallback
}

func mustInt64(key string, fallback int64) int64 {
    if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
        parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
        if err == nil {
            return parsed
        }
    }
    return fallback
}

func mustDuration(key, fallback string) time.Duration {
    raw := getenv(key, fallback)
    parsed, err := time.ParseDuration(raw)
    if err != nil {
        parsed, _ = time.ParseDuration(fallback)
    }
    return parsed
}

func splitCSV(raw string) []string {
    if strings.TrimSpace(raw) == "" {
        return nil
    }

    parts := strings.Split(raw, ",")
    values := make([]string, 0, len(parts))
    for _, part := range parts {
        value := strings.TrimSpace(part)
        if value != "" {
            values = append(values, value)
        }
    }
    return values
}
