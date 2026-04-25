package main

import (
    "context"
    "log"
    "os/signal"
    "syscall"

    "github.com/micromax/infrastructure/kubernetes/autoscaler/internal/config"
    "github.com/micromax/infrastructure/kubernetes/autoscaler/internal/metrics"
    "github.com/micromax/infrastructure/kubernetes/autoscaler/internal/scaler"
)

func main() {
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    cfg, err := config.FromEnv()
    if err != nil {
        log.Fatalf("load config: %v", err)
    }

    metricsClient := metrics.NewHTTPClient(cfg.MetricsEndpoints, cfg.MetricsTimeout)

    controller, err := scaler.NewController(cfg, metricsClient)
    if err != nil {
        log.Fatalf("create controller: %v", err)
    }

    log.Printf("volatility scaler started for %s/%s", cfg.TargetNamespace, cfg.TargetDeployment)

    if err := controller.Run(ctx); err != nil && err != context.Canceled {
        log.Fatalf("run controller: %v", err)
    }
}
