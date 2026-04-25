package metrics

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type Snapshot struct {
    Source               string    `json:"source"`
    RedisPubSubDepth     int64     `json:"redisPubSubDepth"`
    ProcessingBacklogMs  int64     `json:"processingBacklogMs"`
    WebsocketLatencyP95  int64     `json:"websocketLatencyP95Ms"`
    MessagesPerSecond    float64   `json:"messagesPerSecond"`
    CapturedAt           time.Time `json:"capturedAt"`
}

type Client interface {
    Collect(ctx context.Context) ([]Snapshot, error)
}

type HTTPClient struct {
    endpoints []string
    client    *http.Client
}

func NewHTTPClient(endpoints []string, timeout time.Duration) *HTTPClient {
    return &HTTPClient{
        endpoints: endpoints,
        client: &http.Client{Timeout: timeout},
    }
}

func (c *HTTPClient) Collect(ctx context.Context) ([]Snapshot, error) {
    snapshots := make([]Snapshot, 0, len(c.endpoints))

    for _, endpoint := range c.endpoints {
        req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
        if err != nil {
            return nil, fmt.Errorf("build metrics request for %s: %w", endpoint, err)
        }

        resp, err := c.client.Do(req)
        if err != nil {
            return nil, fmt.Errorf("request metrics from %s: %w", endpoint, err)
        }

        if resp.StatusCode >= http.StatusMultipleChoices {
            resp.Body.Close()
            return nil, fmt.Errorf("metrics endpoint %s returned %s", endpoint, resp.Status)
        }

        var snapshot Snapshot
        if err := json.NewDecoder(resp.Body).Decode(&snapshot); err != nil {
            resp.Body.Close()
            return nil, fmt.Errorf("decode metrics from %s: %w", endpoint, err)
        }
        resp.Body.Close()

        if snapshot.Source == "" {
            snapshot.Source = endpoint
        }
        if snapshot.CapturedAt.IsZero() {
            snapshot.CapturedAt = time.Now().UTC()
        }

        snapshots = append(snapshots, snapshot)
    }

    return snapshots, nil
}
