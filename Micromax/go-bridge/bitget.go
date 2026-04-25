package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	bitgetCreateSubaccountPath = "/api/v2/broker/account/create-subaccount"
	bitgetCreateSubaccountAPIKeyPath = "/api/v2/broker/manage/create-subaccount-apikey"
	bitgetPlaceOrderPath = "/api/v2/mix/order/place-order"
)

type BitgetClient struct {
	BaseURL      string
	APIKey       string
	SecretKey    string
	Passphrase   string
	Locale       string
	ChannelCode  string
	HTTPClient   *http.Client
}

type BitgetAPIEnvelope struct {
	Code        string          `json:"code"`
	Msg         string          `json:"msg"`
	RequestTime int64           `json:"requestTime"`
	Data        json.RawMessage `json:"data"`
}

type CreateBitgetSubaccountRequest struct {
	SubaccountName string `json:"subaccount_name"`
	Label          string `json:"label,omitempty"`
}

type CreateBitgetSubaccountData struct {
	SubUID         string   `json:"subUid"`
	SubaccountName string   `json:"subaccountName"`
	Status         string   `json:"status"`
	PermList       []string `json:"permList"`
	Label          string   `json:"label"`
	CTime          string   `json:"cTime"`
}

type CreateBitgetSubaccountAPIKeyRequest struct {
	SubUID     string   `json:"sub_uid"`
	Passphrase string   `json:"passphrase"`
	Label      string   `json:"label"`
	IPList     []string `json:"ip_list,omitempty"`
	PermType   string   `json:"perm_type"`
	PermList   []string `json:"perm_list"`
}

type CreateBitgetSubaccountAPIKeyData struct {
	SubUID    string   `json:"subUid"`
	APIKey    string   `json:"apiKey"`
	SecretKey string   `json:"secretKey"`
	Label     string   `json:"label"`
	IPList    []string `json:"ipList"`
	PermType  string   `json:"permType"`
	PermList  []string `json:"permList"`
}

type BitgetFollower struct {
	ID            string                 `json:"id"`
	MasterID      string                 `json:"master_id"`
	Username      string                 `json:"username"`
	APIKey        string                 `json:"bitget_api_key"`
	APISecret     string                 `json:"bitget_api_secret"`
	Passphrase    string                 `json:"bitget_passphrase"`
	VolumeFactor  float64                `json:"volume_factor"`
	Active        bool                   `json:"active"`
	Metadata      map[string]interface{} `json:"metadata"`
}

type BitgetFollowerOrderSignal struct {
	MasterID    string                 `json:"master_id"`
	Symbol      string                 `json:"symbol"`
	ProductType string                 `json:"product_type"`
	MarginMode  string                 `json:"margin_mode"`
	MarginCoin  string                 `json:"margin_coin,omitempty"`
	Side        string                 `json:"side"`
	TradeSide   string                 `json:"trade_side,omitempty"`
	OrderType   string                 `json:"order_type"`
	Force       string                 `json:"force,omitempty"`
	Size        float64                `json:"size"`
	Price       *float64               `json:"price,omitempty"`
	ClientOID   string                 `json:"client_oid,omitempty"`
	ReduceOnly  *bool                  `json:"reduce_only,omitempty"`
	Extra       map[string]interface{} `json:"extra,omitempty"`
}

type BitgetFollowerExecutionResult struct {
	FollowerID   string                 `json:"follower_id"`
	Username     string                 `json:"username,omitempty"`
	Success      bool                   `json:"success"`
	Status       string                 `json:"status"`
	LatencyMS    int64                  `json:"latency_ms"`
	BridgeStatus int                    `json:"bridge_status,omitempty"`
	OrderID      string                 `json:"order_id,omitempty"`
	ClientOID    string                 `json:"client_oid,omitempty"`
	Error        string                 `json:"error,omitempty"`
	Response     map[string]interface{} `json:"response,omitempty"`
}

type BitgetFollowerExecuteResponse struct {
	Success          bool                            `json:"success"`
	MasterID         string                          `json:"master_id"`
	Symbol           string                          `json:"symbol"`
	FollowersFound   int                             `json:"followers_found"`
	FollowersTried   int                             `json:"followers_tried"`
	FollowersSuccess int                             `json:"followers_success"`
	FollowersFailed  int                             `json:"followers_failed"`
	DryRun           bool                            `json:"dry_run"`
	DurationMS       int64                           `json:"duration_ms"`
	Results          []BitgetFollowerExecutionResult `json:"results"`
}

func createBitgetSubaccountHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		client, err := newMasterBitgetClient(cfg)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var req CreateBitgetSubaccountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		if strings.TrimSpace(req.SubaccountName) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "subaccount_name is required"})
			return
		}

		resp, status, err := client.CreateSubaccount(r.Context(), req)
		if err != nil {
			writeJSON(w, status, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    resp,
		})
	}
}

func createBitgetSubaccountAPIKeyHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		client, err := newMasterBitgetClient(cfg)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var req CreateBitgetSubaccountAPIKeyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		if strings.TrimSpace(req.SubUID) == "" || strings.TrimSpace(req.Passphrase) == "" || strings.TrimSpace(req.Label) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sub_uid, passphrase, and label are required"})
			return
		}
		if strings.TrimSpace(req.PermType) == "" || len(req.PermList) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "perm_type and perm_list are required"})
			return
		}

		resp, status, err := client.CreateSubaccountAPIKey(r.Context(), req)
		if err != nil {
			writeJSON(w, status, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    resp,
		})
	}
}

func executeBitgetFollowersHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		var signal BitgetFollowerOrderSignal
		if err := json.NewDecoder(r.Body).Decode(&signal); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		if err := validateBitgetSignal(signal); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		started := time.Now()
		ctx, cancel := context.WithTimeout(r.Context(), cfg.RequestTimeout)
		defer cancel()

		followers, err := fetchBitgetFollowers(ctx, cfg, signal.MasterID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}

		results := executeBitgetForFollowers(ctx, cfg, followers, signal)
		successful := countBitgetSuccessful(results)

		writeJSON(w, http.StatusOK, BitgetFollowerExecuteResponse{
			Success:          true,
			MasterID:         signal.MasterID,
			Symbol:           strings.ToUpper(signal.Symbol),
			FollowersFound:   len(followers),
			FollowersTried:   len(results),
			FollowersSuccess: successful,
			FollowersFailed:  len(results) - successful,
			DryRun:           cfg.DryRun,
			DurationMS:       time.Since(started).Milliseconds(),
			Results:          results,
		})
	}
}

func newMasterBitgetClient(cfg Config) (*BitgetClient, error) {
	if strings.TrimSpace(cfg.BitgetAPIKey) == "" || strings.TrimSpace(cfg.BitgetSecretKey) == "" || strings.TrimSpace(cfg.BitgetPassphrase) == "" {
		return nil, errors.New("BITGET_API_KEY, BITGET_SECRET_KEY, and BITGET_PASSPHRASE must be configured")
	}

	return &BitgetClient{
		BaseURL:     strings.TrimRight(cfg.BitgetBaseURL, "/"),
		APIKey:      cfg.BitgetAPIKey,
		SecretKey:   cfg.BitgetSecretKey,
		Passphrase:  cfg.BitgetPassphrase,
		Locale:      cfg.BitgetLocale,
		ChannelCode: cfg.BitgetChannelCode,
		HTTPClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}, nil
}

func (c *BitgetClient) CreateSubaccount(ctx context.Context, req CreateBitgetSubaccountRequest) (*CreateBitgetSubaccountData, int, error) {
	payload := map[string]interface{}{
		"subaccountName": strings.TrimSpace(req.SubaccountName),
	}
	if strings.TrimSpace(req.Label) != "" {
		payload["label"] = strings.TrimSpace(req.Label)
	}

	var data CreateBitgetSubaccountData
	status, err := c.postJSON(ctx, bitgetCreateSubaccountPath, payload, &data)
	if err != nil {
		return nil, status, err
	}

	return &data, http.StatusOK, nil
}

func (c *BitgetClient) CreateSubaccountAPIKey(ctx context.Context, req CreateBitgetSubaccountAPIKeyRequest) (*CreateBitgetSubaccountAPIKeyData, int, error) {
	payload := map[string]interface{}{
		"subUid":     strings.TrimSpace(req.SubUID),
		"passphrase": strings.TrimSpace(req.Passphrase),
		"label":      strings.TrimSpace(req.Label),
		"permType":   strings.TrimSpace(req.PermType),
		"permList":   req.PermList,
	}
	if len(req.IPList) > 0 {
		payload["ipList"] = req.IPList
	}

	var data CreateBitgetSubaccountAPIKeyData
	status, err := c.postJSON(ctx, bitgetCreateSubaccountAPIKeyPath, payload, &data)
	if err != nil {
		return nil, status, err
	}

	return &data, http.StatusOK, nil
}

func (c *BitgetClient) PlaceOrder(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, int, error) {
	var data map[string]interface{}
	status, err := c.postJSON(ctx, bitgetPlaceOrderPath, payload, &data)
	if err != nil {
		return nil, status, err
	}
	return data, http.StatusOK, nil
}

func (c *BitgetClient) postJSON(ctx context.Context, path string, payload interface{}, out interface{}) (int, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("marshal request body: %w", err)
	}

	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	signature := signBitget(timestamp, http.MethodPost, path, body, c.SecretKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("build Bitget request: %w", err)
	}

	req.Header.Set("ACCESS-KEY", c.APIKey)
	req.Header.Set("ACCESS-SIGN", signature)
	req.Header.Set("ACCESS-TIMESTAMP", timestamp)
	req.Header.Set("ACCESS-PASSPHRASE", c.Passphrase)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("locale", firstNonEmpty(c.Locale, "en-US"))
	if strings.TrimSpace(c.ChannelCode) != "" {
		req.Header.Set("X-CHANNEL-API-CODE", c.ChannelCode)
	}

	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return http.StatusBadGateway, fmt.Errorf("request Bitget: %w", err)
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		return res.StatusCode, fmt.Errorf("Bitget returned %d: %s", res.StatusCode, strings.TrimSpace(string(raw)))
	}

	var envelope BitgetAPIEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return http.StatusBadGateway, fmt.Errorf("decode Bitget envelope: %w", err)
	}
	if envelope.Code != "00000" {
		return http.StatusBadGateway, fmt.Errorf("Bitget error %s: %s", envelope.Code, envelope.Msg)
	}

	if out != nil && len(envelope.Data) > 0 {
		if err := json.Unmarshal(envelope.Data, out); err != nil {
			return http.StatusBadGateway, fmt.Errorf("decode Bitget data: %w", err)
		}
	}

	return http.StatusOK, nil
}

func signBitget(timestamp, method, path string, body []byte, secretKey string) string {
	message := timestamp + strings.ToUpper(method) + path + string(body)
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func fetchBitgetFollowers(ctx context.Context, cfg Config, masterID string) ([]BitgetFollower, error) {
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
		return nil, fmt.Errorf("request Bitget followers from Supabase: %w", err)
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("Supabase returned %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var rawFollowers []map[string]interface{}
	if err := json.Unmarshal(body, &rawFollowers); err != nil {
		return nil, fmt.Errorf("decode followers response: %w", err)
	}

	followers := make([]BitgetFollower, 0, len(rawFollowers))
	for _, row := range rawFollowers {
		follower := BitgetFollower{
			ID:           mapString(row["id"]),
			MasterID:     mapString(row[cfg.MasterIDColumn]),
			Username:     mapString(row["username"]),
			APIKey:       mapString(row[cfg.FollowerAPIKeyColumn]),
			APISecret:    mapString(row[cfg.FollowerAPISecretColumn]),
			Passphrase:   mapString(row[cfg.FollowerPassphraseColumn]),
			VolumeFactor: mapFloat(row["volume_factor"], 1),
			Active:       mapBool(row[cfg.ActiveColumn]),
		}
		if metadata, ok := row["metadata"].(map[string]interface{}); ok {
			follower.Metadata = metadata
		}

		if follower.ID == "" {
			follower.ID = mapString(row["follower_id"])
		}
		if follower.VolumeFactor == 0 {
			follower.VolumeFactor = 1
		}

		if follower.APIKey == "" || follower.APISecret == "" || follower.Passphrase == "" {
			continue
		}

		followers = append(followers, follower)
	}

	return followers, nil
}

func executeBitgetForFollowers(ctx context.Context, cfg Config, followers []BitgetFollower, signal BitgetFollowerOrderSignal) []BitgetFollowerExecutionResult {
	results := make([]BitgetFollowerExecutionResult, 0, len(followers))
	if len(followers) == 0 {
		return results
	}

	semaphore := make(chan struct{}, cfg.MaxConcurrency)
	resultsCh := make(chan BitgetFollowerExecutionResult, len(followers))
	var wg sync.WaitGroup

	for _, follower := range followers {
		follower := follower
		wg.Add(1)

		go func() {
			defer wg.Done()

			select {
			case semaphore <- struct{}{}:
			case <-ctx.Done():
				resultsCh <- BitgetFollowerExecutionResult{
					FollowerID: follower.ID,
					Username:   follower.Username,
					Success:    false,
					Status:     "CANCELLED",
					Error:      ctx.Err().Error(),
				}
				return
			}
			defer func() { <-semaphore }()

			resultsCh <- executeBitgetTrade(ctx, cfg, follower, signal)
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

func executeBitgetTrade(ctx context.Context, cfg Config, follower BitgetFollower, signal BitgetFollowerOrderSignal) BitgetFollowerExecutionResult {
	started := time.Now()
	client := &BitgetClient{
		BaseURL:     strings.TrimRight(cfg.BitgetBaseURL, "/"),
		APIKey:      follower.APIKey,
		SecretKey:   follower.APISecret,
		Passphrase:  follower.Passphrase,
		Locale:      cfg.BitgetLocale,
		ChannelCode: cfg.BitgetChannelCode,
		HTTPClient: &http.Client{
			Timeout: cfg.RequestTimeout,
		},
	}

	payload := buildBitgetOrderPayload(signal, follower)
	clientOID := mapString(payload["clientOid"])

	if cfg.DryRun {
		return BitgetFollowerExecutionResult{
			FollowerID: follower.ID,
			Username:   follower.Username,
			Success:    true,
			Status:     "DRY_RUN",
			LatencyMS:  time.Since(started).Milliseconds(),
			ClientOID:  clientOID,
			Response:   payload,
		}
	}

	response, statusCode, err := client.PlaceOrder(ctx, payload)
	if err != nil {
		return BitgetFollowerExecutionResult{
			FollowerID:   follower.ID,
			Username:     follower.Username,
			Success:      false,
			Status:       "BRIDGE_REJECTED",
			LatencyMS:    time.Since(started).Milliseconds(),
			BridgeStatus: statusCode,
			ClientOID:    clientOID,
			Error:        err.Error(),
		}
	}

	orderID := mapString(response["orderId"])
	if orderID == "" {
		orderID = mapString(response["ordId"])
	}

	return BitgetFollowerExecutionResult{
		FollowerID:   follower.ID,
		Username:     follower.Username,
		Success:      true,
		Status:       "OK",
		LatencyMS:    time.Since(started).Milliseconds(),
		BridgeStatus: statusCode,
		OrderID:      orderID,
		ClientOID:    clientOID,
		Response:     response,
	}
}

func buildBitgetOrderPayload(signal BitgetFollowerOrderSignal, follower BitgetFollower) map[string]interface{} {
	size := signal.Size * follower.VolumeFactor
	payload := map[string]interface{}{
		"symbol":      strings.ToUpper(strings.TrimSpace(signal.Symbol)),
		"productType": strings.TrimSpace(signal.ProductType),
		"marginMode":  strings.TrimSpace(signal.MarginMode),
		"side":        strings.ToLower(strings.TrimSpace(signal.Side)),
		"orderType":   strings.ToLower(strings.TrimSpace(signal.OrderType)),
		"size":        formatBitgetFloat(size),
	}

	if strings.TrimSpace(signal.MarginCoin) != "" {
		payload["marginCoin"] = strings.ToUpper(strings.TrimSpace(signal.MarginCoin))
	}
	if strings.TrimSpace(signal.TradeSide) != "" {
		payload["tradeSide"] = strings.ToLower(strings.TrimSpace(signal.TradeSide))
	}
	if strings.TrimSpace(signal.Force) != "" {
		payload["force"] = strings.ToLower(strings.TrimSpace(signal.Force))
	}
	if signal.Price != nil {
		payload["price"] = formatBitgetFloat(*signal.Price)
	}
	if signal.ReduceOnly != nil {
		payload["reduceOnly"] = *signal.ReduceOnly ? "YES" : "NO"
	}

	clientOID := strings.TrimSpace(signal.ClientOID)
	if clientOID == "" {
		clientOID = fmt.Sprintf("%s-%d", firstNonEmpty(follower.ID, follower.Username, "follower"), time.Now().UnixMilli())
	}
	payload["clientOid"] = clientOID

	for key, value := range signal.Extra {
		payload[key] = value
	}

	return payload
}

func validateBitgetSignal(signal BitgetFollowerOrderSignal) error {
	if strings.TrimSpace(signal.MasterID) == "" {
		return errors.New("master_id is required")
	}
	if strings.TrimSpace(signal.Symbol) == "" {
		return errors.New("symbol is required")
	}
	if strings.TrimSpace(signal.ProductType) == "" {
		return errors.New("product_type is required")
	}
	if strings.TrimSpace(signal.MarginMode) == "" {
		return errors.New("margin_mode is required")
	}
	side := strings.ToLower(strings.TrimSpace(signal.Side))
	if side != "buy" && side != "sell" {
		return errors.New("side must be buy or sell")
	}
	orderType := strings.ToLower(strings.TrimSpace(signal.OrderType))
	if orderType != "market" && orderType != "limit" {
		return errors.New("order_type must be market or limit")
	}
	if signal.Size <= 0 {
		return errors.New("size must be greater than zero")
	}
	if orderType == "limit" && signal.Price == nil {
		return errors.New("price is required for limit orders")
	}
	return nil
}

func countBitgetSuccessful(results []BitgetFollowerExecutionResult) int {
	successful := 0
	for _, result := range results {
		if result.Success {
			successful++
		}
	}
	return successful
}

func formatBitgetFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func mapString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	case float64:
		return formatBitgetFloat(typed)
	case json.Number:
		return typed.String()
	default:
		return ""
	}
}

func mapFloat(value interface{}, fallback float64) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case json.Number:
		parsed, err := typed.Float64()
		if err == nil {
			return parsed
		}
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err == nil {
			return parsed
		}
	}
	return fallback
}

func mapBool(value interface{}) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return strings.EqualFold(strings.TrimSpace(typed), "true")
	default:
		return false
	}
}
