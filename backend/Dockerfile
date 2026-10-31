# Build stage
FROM golang:1.26-alpine AS builder
ARG BUILD_FULL=false

WORKDIR /app

COPY go.mod go.sum ./
RUN if [ "$BUILD_FULL" = "true" ]; then go mod download; fi

COPY . .
RUN if [ "$BUILD_FULL" = "true" ]; then \
      CGO_ENABLED=0 GOMAXPROCS=1 GOOS=linux go build -p 1 -ldflags="-s -w" -o main ./cmd/api; \
    else \
      printf 'package main\nimport (\n\t"net/http"\n\t"os"\n)\nfunc main() {\n\tp := os.Getenv("PORT")\n\tif p == "" {\n\t\tp = "8080"\n\t}\n\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set("Content-Type", "application/json")\n\t\tw.WriteHeader(http.StatusOK)\n\t\t_, _ = w.Write([]byte(`{"status":"ok","mode":"dormant-standby","message":"Primary server is hosted on VPS"}`))\n\t})\n\t_ = http.ListenAndServe(":"+p, nil)\n}\n' > standby.go && \
      CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o main standby.go; \
    fi

# Final stage
FROM alpine:3.21

RUN apk --no-cache add ca-certificates tzdata && \
    addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations

RUN mkdir -p /app/sessions /app/uploads/ads /app/static/shares && \
    chmod -R 775 /app/uploads /app/static && \
    chown -R appuser:appgroup /app

USER 10001:10001

EXPOSE 8080

CMD ["./main"]
