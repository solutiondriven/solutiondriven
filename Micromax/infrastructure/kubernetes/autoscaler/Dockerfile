FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/volatility-scaler ./cmd/volatility-scaler

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/volatility-scaler /volatility-scaler
USER 65532:65532
ENTRYPOINT ["/volatility-scaler"]
