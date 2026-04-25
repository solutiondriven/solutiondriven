package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Config struct {
	Port                 string
	SupabaseURL          string
	SupabaseServiceKey   string
	FollowersTable       string
	MasterIDColumn       string
	ActiveColumn         string
	FollowerAPIKeyColumn string
	FollowerAPISecretColumn string
	FollowerPassphraseColumn string
	MT5BridgeURL         string
	MT5BridgePath        string
	BitgetBaseURL        string
	BitgetAPIKey         string
	BitgetSecretKey      string
	BitgetPassphrase     string
	BitgetLocale         string
	BitgetChannelCode    string
	MaxConcurrency       int
	RequestTimeout       time.Duration
	MT5BridgeTimeout     time.Duration
	DryRun               bool
}

type TradeSignal struct {
	MasterID   string   `json:"master_id"`
	Symbol     string   `json:"symbol"`
	Action     string   `json:"action"`
	Volume     float64  `json:"volume"`
	StopLoss   *float64 `json:"stop_loss,omitempty"`
	TakeProfit *float64 `json:"take_profit,omitempty"`
	Comment    string   `json:"comment,omitempty"`
}

type Follower struct {
	ID            string                 `json:"id"`
	MasterID      string                 `json:"master_id"`
	Username      string                 `json:"username"`
	AccountID     string                 `json:"account_id"`
	Login         string                 `json:"login"`
	Password      string                 `json:"password"`
	Server        string                 `json:"server"`
	BridgeAccount string                 `json:"bridge_account_id"`
	VolumeFactor  float64                `json:"volume_factor"`
	Active        bool                   `json:"active"`
	Metadata      map[string]interface{} `json:"metadata"`
}

type ExecutionResult struct {
	FollowerID   string                 `json:"follower_id"`
	Username     string                 `json:"username,omitempty"`
	Success      bool                   `json:"success"`
	Status       string                 `json:"status"`
	LatencyMS    int64                  `json:"latency_ms"`
	BridgeStatus int                    `json:"bridge_status,omitempty"`
	OrderID      string                 `json:"order_id,omitempty"`
	Error        string                 `json:"error,omitempty"`
	Response     map[string]interface{} `json:"response,omitempty"`
}

type ExecuteResponse struct {
	Success          bool              `json:"success"`
	MasterID         string            `json:"master_id"`
	Symbol           string            `json:"symbol"`
	Action           string            `json:"action"`
	FollowersFound   int               `json:"followers_found"`
	FollowersTried   int               `json:"followers_tried"`
	FollowersSuccess int               `json:"followers_success"`
	FollowersFailed  int               `json:"followers_failed"`
	DryRun           bool              `json:"dry_run"`
	DurationMS       int64             `json:"duration_ms"`
	Results          []ExecutionResult `json:"results"`
}

type MT5BridgeRequest struct {
	FollowerID      string      `json:"follower_id"`
	AccountID       string      `json:"account_id,omitempty"`
	Login           string      `json:"login,omitempty"`
	Password        string      `json:"password,omitempty"`
	Server          string      `json:"server,omitempty"`
	BridgeAccountID string      `json:"bridge_account_id,omitempty"`
	Trade           TradeSignal `json:"trade"`
}

func main() {
	loadDotEnv(".env")
	cfg := loadConfig()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler(cfg))
	mux.HandleFunc("/signals/execute", executeHandler(cfg))
	mux.HandleFunc("/bitget/subaccounts/create", createBitgetSubaccountHandler(cfg))
	mux.HandleFunc("/bitget/subaccounts/apikeys/create", createBitgetSubaccountAPIKeyHandler(cfg))
	mux.HandleFunc("/bitget/followers/execute", executeBitgetFollowersHandler(cfg))

	addr := ":" + cfg.Port
	log.Printf("Go bridge listening on %s", addr)
	log.Printf("Supabase table=%s, MT5 bridge=%s%s, dry_run=%t", cfg.FollowersTable, cfg.MT5BridgeURL, cfg.MT5BridgePath, cfg.DryRun)

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server failed: %v", err)
	}
}

func healthHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":         "ok",
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"followers_table": cfg.FollowersTable,
			"mt5_bridge_url":  cfg.MT5BridgeURL + cfg.MT5BridgePath,
			"bitget_base_url": cfg.BitgetBaseURL,
			"dry_run":         cfg.DryRun,
		})
	}
}

func executeHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		var signal TradeSignal
		if err := json.NewDecoder(r.Body).Decode(&signal); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		if err := validateSignal(signal); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		started := time.Now()
		ctx, cancel := context.WithTimeout(r.Context(), cfg.RequestTimeout)
		defer cancel()

		followers, err := fetchFollowers(ctx, cfg, signal.MasterID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}

		results := executeForFollowers(ctx, cfg, followers, signal)

		response := ExecuteResponse{
			Success:          true,
			MasterID:         signal.MasterID,
			Symbol:           strings.ToUpper(signal.Symbol),
			Action:           strings.ToUpper(signal.Action),
			FollowersFound:   len(followers),
			FollowersTried:   len(results),
			FollowersSuccess: countSuccessful(results),
			FollowersFailed:  len(results) - countSuccessful(results),
			DryRun:           cfg.DryRun,
			DurationMS:       time.Since(started).Milliseconds(),
			Results:          results,
		}

		writeJSON(w, http.StatusOK, response)
	}
}

func fetchFollowers(ctx context.Context, cfg Config, masterID string) ([]Follower, error) {
	base := strings.TrimRight(cfg.SupabaseURL, "/")
	endpoint := fmt.Sprintf("%s/rest/v1/%s", base, cfg.FollowersTable)

	query := url.Values{}
	query.Set("select", "*")
	query.Set(cfg.MasterIDColumn, "eq."+masterID)
	query.Set(cfg.ActiveColumn, "eq.true")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint+"?"+query.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("build Supabase request: %w", err)
	}

	req.Header.Set("apikey", cfg.SupabaseServiceKey)
	req.Header.Set("Authorization", "Bearer "+cfg.SupabaseServiceKey)
	req.Header.Set("Accept", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request followers from Supabase: %w", err)
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("Supabase returned %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var followers []Follower
	if err := json.Unmarshal(body, &followers); err != nil {
		return nil, fmt.Errorf("decode followers response: %w", err)
	}

	for i := range followers {
		if followers[i].VolumeFactor == 0 {
			followers[i].VolumeFactor = 1
		}
	}

	return followers, nil
}

func executeForFollowers(ctx context.Context, cfg Config, followers []Follower, signal TradeSignal) []ExecutionResult {
	results := make([]ExecutionResult, 0, len(followers))
	if len(followers) == 0 {
		return results
	}

	semaphore := make(chan struct{}, cfg.MaxConcurrency)
	resultsCh := make(chan ExecutionResult, len(followers))
	var wg sync.WaitGroup

	for _, follower := range followers {
		follower := follower
		wg.Add(1)

		go func() {
			defer wg.Done()

			select {
			case semaphore <- struct{}{}:
			case <-ctx.Done():
				resultsCh <- ExecutionResult{
					FollowerID: follower.ID,
					Username:   follower.Username,
					Success:    false,
					Status:     "CANCELLED",
					Error:      ctx.Err().Error(),
				}
				return
			}
			defer func() { <-semaphore }()

			resultsCh <- executeTrade(ctx, cfg, follower, signal)
		}()
	}

	go func() {
		wg.Wait()
		close(resultsCh)
	}()

	for result := range resultsCh {
		results = append(results, result)
	}

	return results
}

func executeTrade(ctx context.Context, cfg Config, follower Follower, signal TradeSignal) ExecutionResult {
	started := time.Now()
	adjustedSignal := signal
	adjustedSignal.Symbol = strings.ToUpper(signal.Symbol)
	adjustedSignal.Action = strings.ToUpper(signal.Action)
	adjustedSignal.Volume = signal.Volume * follower.VolumeFactor

	if cfg.DryRun {
		return ExecutionResult{
			FollowerID: follower.ID,
			Username:   follower.Username,
			Success:    true,
			Status:     "DRY_RUN",
			LatencyMS:  time.Since(started).Milliseconds(),
			Response: map[string]interface{}{
				"bridge_url": cfg.MT5BridgeURL + cfg.MT5BridgePath,
				"trade":      adjustedSignal,
			},
		}
	}

	bridgeCtx, cancel := context.WithTimeout(ctx, cfg.MT5BridgeTimeout)
	defer cancel()

	payload := MT5BridgeRequest{
		FollowerID:      follower.ID,
		AccountID:       firstNonEmpty(follower.AccountID, follower.Login),
		Login:           follower.Login,
		Password:        follower.Password,
		Server:          follower.Server,
		BridgeAccountID: follower.BridgeAccount,
		Trade:           adjustedSignal,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return ExecutionResult{
			FollowerID: follower.ID,
			Username:   follower.Username,
			Success:    false,
			Status:     "SERIALIZATION_ERROR",
			LatencyMS:  time.Since(started).Milliseconds(),
			Error:      err.Error(),
		}
	}

	endpoint := strings.TrimRight(cfg.MT5BridgeURL, "/") + cfg.MT5BridgePath
	req, err := http.NewRequestWithContext(bridgeCtx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return ExecutionResult{
			FollowerID: follower.ID,
			Username:   follower.Username,
			Success:    false,
			Status:     "REQUEST_BUILD_ERROR",
			LatencyMS:  time.Since(started).Milliseconds(),
			Error:      err.Error(),
		}
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return ExecutionResult{
			FollowerID: follower.ID,
			Username:   follower.Username,
			Success:    false,
			Status:     "BRIDGE_ERROR",
			LatencyMS:  time.Since(started).Milliseconds(),
			Error:      err.Error(),
		}
	}
	defer res.Body.Close()

	rawResponse, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	latency := time.Since(started).Milliseconds()

	parsed := map[string]interface{}{}
	if len(rawResponse) > 0 {
		_ = json.Unmarshal(rawResponse, &parsed)
	}

	success := res.StatusCode < 300
	status := "OK"
	if !success {
		status = "BRIDGE_REJECTED"
	}
	if rawStatus, ok := parsed["status"].(string); ok && rawStatus != "" {
		status = rawStatus
	}

	result := ExecutionResult{
		FollowerID:   follower.ID,
		Username:     follower.Username,
		Success:      success,
		Status:       status,
		LatencyMS:    latency,
		BridgeStatus: res.StatusCode,
		Response:     parsed,
	}

	if orderID, ok := parsed["order_id"].(string); ok {
		result.OrderID = orderID
	}

	if !success {
		if errMsg, ok := parsed["error"].(string); ok && errMsg != "" {
			result.Error = errMsg
		} else {
			result.Error = strings.TrimSpace(string(rawResponse))
		}
	}

	return result
}

func validateSignal(signal TradeSignal) error {
	if strings.TrimSpace(signal.MasterID) == "" {
		return errors.New("master_id is required")
	}
	if strings.TrimSpace(signal.Symbol) == "" {
		return errors.New("symbol is required")
	}
	action := strings.ToUpper(strings.TrimSpace(signal.Action))
	if action != "BUY" && action != "SELL" {
		return errors.New("action must be BUY or SELL")
	}
	if signal.Volume <= 0 {
		return errors.New("volume must be greater than zero")
	}
	return nil
}

func countSuccessful(results []ExecutionResult) int {
	successful := 0
	for _, result := range results {
		if result.Success {
			successful++
		}
	}
	return successful
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func loadConfig() Config {
	cfg := Config{
		Port:               getEnv("PORT", "8081"),
		SupabaseURL:        mustEnv("SUPABASE_URL"),
		SupabaseServiceKey: mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
		FollowersTable:     getEnv("SUPABASE_FOLLOWERS_TABLE", "followers"),
		MasterIDColumn:     getEnv("SUPABASE_MASTER_ID_COLUMN", "master_id"),
		ActiveColumn:       getEnv("SUPABASE_ACTIVE_COLUMN", "active"),
		FollowerAPIKeyColumn: getEnv("SUPABASE_FOLLOWER_API_KEY_COLUMN", "bitget_api_key"),
		FollowerAPISecretColumn: getEnv("SUPABASE_FOLLOWER_API_SECRET_COLUMN", "bitget_api_secret"),
		FollowerPassphraseColumn: getEnv("SUPABASE_FOLLOWER_PASSPHRASE_COLUMN", "bitget_passphrase"),
		MT5BridgeURL:       getEnv("MT5_BRIDGE_URL", "http://127.0.0.1:9000"),
		MT5BridgePath:      getEnv("MT5_BRIDGE_PATH", "/trade"),
		BitgetBaseURL:      getEnv("BITGET_BASE_URL", "https://api.bitget.com"),
		BitgetAPIKey:       strings.TrimSpace(os.Getenv("BITGET_API_KEY")),
		BitgetSecretKey:    strings.TrimSpace(os.Getenv("BITGET_SECRET_KEY")),
		BitgetPassphrase:   strings.TrimSpace(os.Getenv("BITGET_PASSPHRASE")),
		BitgetLocale:       getEnv("BITGET_LOCALE", "en-US"),
		BitgetChannelCode:  strings.TrimSpace(os.Getenv("BITGET_CHANNEL_API_CODE")),
		MaxConcurrency:     getEnvInt("MAX_CONCURRENCY", 100),
		RequestTimeout:     time.Duration(getEnvInt("REQUEST_TIMEOUT_MS", 10000)) * time.Millisecond,
		MT5BridgeTimeout:   time.Duration(getEnvInt("MT5_BRIDGE_TIMEOUT_MS", 5000)) * time.Millisecond,
		DryRun:             getEnvBool("DRY_RUN", false),
	}

	if !strings.HasPrefix(cfg.MT5BridgePath, "/") {
		cfg.MT5BridgePath = "/" + cfg.MT5BridgePath
	}

	return cfg
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		if key == "" || os.Getenv(key) != "" {
			continue
		}

		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)
		_ = os.Setenv(key, value)
	}
}

func mustEnv(key string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		log.Fatalf("missing required environment variable %s", key)
	}
	return value
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		log.Printf("invalid integer for %s=%q, using fallback %d", key, value, fallback)
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if value == "" {
		return fallback
	}

	switch value {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		log.Printf("invalid boolean for %s=%q, using fallback %t", key, value, fallback)
		return fallback
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
