# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOMAXPROCS=1 GOOS=linux go build -p 1 -ldflags="-s -w" -o main ./cmd/api

# Final stage
FROM alpine:3.21

RUN apk --no-cache add ca-certificates tzdata && \
    addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations

RUN mkdir -p /app/sessions /app/uploads && \
    chown -R appuser:appgroup /app

USER 10001:10001

EXPOSE 8080

CMD ["./main"]

