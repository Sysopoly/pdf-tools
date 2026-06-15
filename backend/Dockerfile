FROM golang:alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /pdf-backend main.go

FROM alpine:3.19

# Install Ghostscript for heavy PDF downsampling
RUN apk add --no-cache ghostscript

WORKDIR /app
COPY --from=builder /pdf-backend /app/pdf-backend

ENV GIN_MODE=release
ENV PORT=8080
EXPOSE 8080

CMD ["/app/pdf-backend"]
