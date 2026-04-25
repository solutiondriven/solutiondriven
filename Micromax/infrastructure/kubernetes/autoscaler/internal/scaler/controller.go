package scaler

import (
    "context"
    "fmt"
    "log"
    "math"
    "time"

    appsv1 "k8s.io/api/apps/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/rest"

    "github.com/micromax/infrastructure/kubernetes/autoscaler/internal/config"
    "github.com/micromax/infrastructure/kubernetes/autoscaler/internal/metrics"
)

type Controller struct {
    cfg            config.Config
    metricsClient  metrics.Client
    kubeClient     kubernetes.Interface
    lastScaleUp    time.Time
    lastScaleDown  time.Time
    healthySince   time.Time
}

type aggregate struct {
    QueueDepth         int64
    ProcessingBacklog  int64
    WebsocketLatency95 int64
    MessagesPerSecond  float64
}

func NewController(cfg config.Config, metricsClient metrics.Client) (*Controller, error) {
    kubeConfig, err := rest.InClusterConfig()
    if err != nil {
        return nil, fmt.Errorf("load in-cluster kubernetes config: %w", err)
    }

    kubeClient, err := kubernetes.NewForConfig(kubeConfig)
    if err != nil {
        return nil, fmt.Errorf("create kubernetes client: %w", err)
    }

    return &Controller{
        cfg:           cfg,
        metricsClient: metricsClient,
        kubeClient:    kubeClient,
        healthySince:  time.Now(),
    }, nil
}

func (c *Controller) Run(ctx context.Context) error {
    ticker := time.NewTicker(c.cfg.PollInterval)
    defer ticker.Stop()

    for {
        if err := c.reconcile(ctx); err != nil {
            log.Printf("reconcile error: %v", err)
        }

        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-ticker.C:
        }
    }
}

func (c *Controller) reconcile(ctx context.Context) error {
    samples, err := c.metricsClient.Collect(ctx)
    if err != nil {
        return err
    }

    pressure := summarize(samples)

    deployment, err := c.kubeClient.AppsV1().Deployments(c.cfg.TargetNamespace).Get(ctx, c.cfg.TargetDeployment, metav1.GetOptions{})
    if err != nil {
        return fmt.Errorf("load target deployment: %w", err)
    }

    current := replicasOf(deployment)
    desired := c.desiredReplicas(current, pressure)
    if desired == current {
        return nil
    }

    deployment.Spec.Replicas = &desired
    if _, err := c.kubeClient.AppsV1().Deployments(c.cfg.TargetNamespace).Update(ctx, deployment, metav1.UpdateOptions{}); err != nil {
        return fmt.Errorf("update deployment replicas: %w", err)
    }

    direction := "down"
    if desired > current {
        direction = "up"
        c.lastScaleUp = time.Now()
    } else {
        c.lastScaleDown = time.Now()
    }

    log.Printf(
        "scaled %s/%s %s from %d to %d replicas | queueDepth=%d backlogMs=%d websocketP95Ms=%d mps=%.2f",
        c.cfg.TargetNamespace,
        c.cfg.TargetDeployment,
        direction,
        current,
        desired,
        pressure.QueueDepth,
        pressure.ProcessingBacklog,
        pressure.WebsocketLatency95,
        pressure.MessagesPerSecond,
    )

    return nil
}

func summarize(samples []metrics.Snapshot) aggregate {
    var result aggregate
    for _, sample := range samples {
        if sample.RedisPubSubDepth > result.QueueDepth {
            result.QueueDepth = sample.RedisPubSubDepth
        }
        if sample.ProcessingBacklogMs > result.ProcessingBacklog {
            result.ProcessingBacklog = sample.ProcessingBacklogMs
        }
        if sample.WebsocketLatencyP95 > result.WebsocketLatency95 {
            result.WebsocketLatency95 = sample.WebsocketLatencyP95
        }
        result.MessagesPerSecond += sample.MessagesPerSecond
    }
    return result
}

func (c *Controller) desiredReplicas(current int32, pressure aggregate) int32 {
    now := time.Now()
    overloaded := pressure.QueueDepth >= c.cfg.QueueDepthThreshold ||
        pressure.ProcessingBacklog >= c.cfg.ProcessingTargetMs ||
        pressure.WebsocketLatency95 >= c.cfg.LatencyTargetMs

    if overloaded {
        c.healthySince = now

        if now.Sub(c.lastScaleUp) < c.cfg.ScaleUpCooldown {
            return current
        }

        desired := current + c.scaleUpMagnitude(pressure)
        return clamp(desired, c.cfg.MinReplicas, c.cfg.MaxReplicas)
    }

    if now.Sub(c.healthySince) < c.cfg.StabilizationWindow {
        return current
    }

    if now.Sub(c.lastScaleDown) < c.cfg.ScaleDownCooldown {
        return current
    }

    desired := current - c.cfg.ScaleDownStep
    return clamp(desired, c.cfg.MinReplicas, c.cfg.MaxReplicas)
}

func (c *Controller) scaleUpMagnitude(pressure aggregate) int32 {
    backlogFactor := safeCeilDiv(pressure.ProcessingBacklog, maxInt64(1, c.cfg.ProcessingTargetMs))
    depthFactor := safeCeilDiv(pressure.QueueDepth, maxInt64(1, c.cfg.QueueDepthThreshold))
    latencyFactor := safeCeilDiv(pressure.WebsocketLatency95, maxInt64(1, c.cfg.LatencyTargetMs))

    maxFactor := maxInt64(backlogFactor, maxInt64(depthFactor, latencyFactor))
    if maxFactor < 1 {
        maxFactor = 1
    }

    step := int32(math.Min(float64(c.cfg.ScaleUpStep*int32(maxFactor)), float64(c.cfg.MaxReplicas)))
    if step < 1 {
        step = 1
    }
    return step
}

func replicasOf(deployment *appsv1.Deployment) int32 {
    if deployment.Spec.Replicas == nil {
        return 1
    }
    return *deployment.Spec.Replicas
}

func safeCeilDiv(value, divisor int64) int64 {
    if divisor <= 0 {
        return 1
    }
    return int64(math.Ceil(float64(value) / float64(divisor)))
}

func maxInt64(a, b int64) int64 {
    if a > b {
        return a
    }
    return b
}

func clamp(value, minValue, maxValue int32) int32 {
    if value < minValue {
        return minValue
    }
    if value > maxValue {
        return maxValue
    }
    return value
}
