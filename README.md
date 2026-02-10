# HTTP Prober

Lightweight HTTP latency probe. Deploy to multiple machines to measure round-trip latency between them.

Each node acts as both a server (receives probes) and a client (sends probes to other nodes).

## Quick Start

```bash
mkdir -p data logs
```

```bash
NODE_NAME=dubai \
TARGETS="eu-north-1=5.6.7.8:3000,us-east-1=9.10.11.12:3000" \
docker compose up --build -d
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `NODE_NAME` | Label for this node | `unknown` |
| `TARGETS` | Comma-separated probe targets (`name=host:port`) | — |
| `PROBE_INTERVAL` | Milliseconds between probe rounds | `300000` (5 min) |
| `PAYLOAD_PATH` | Path to custom JSON payload inside container | `/data/payload.json` |
| `LOG_PATH` | Path to log file inside container | `/logs/probes.log` |

## Adding Targets

Targets are the remote nodes this instance will probe. Set them via the `TARGETS` environment variable.

**Format:** `name=host:port` entries, comma-separated.

```
TARGETS="name1=host1:port1,name2=host2:port2"
```

| Part | Description | Required |
|---|---|---|
| `name` | Label for the target node (used in logs) | Yes |
| `host` | IP address or hostname | Yes |
| `port` | Listening port | No (defaults to `3000`) |

**Examples:**

Single target:

```bash
TARGETS="eu-north-1=5.6.7.8:3000"
```

Multiple targets:

```bash
TARGETS="eu-north-1=5.6.7.8:3000,us-east-1=9.10.11.12:3000,dubai=1.2.3.4:3000"
```

Using hostnames instead of IPs:

```bash
TARGETS="eu-north-1=probe-eu.example.com:3000,us-east-1=probe-us.example.com:3000"
```

Port omitted (defaults to 3000):

```bash
TARGETS="eu-north-1=5.6.7.8"
```

## Custom Payload

Place your JSON file at `./data/payload.json`. It will be mounted into the container and sent as the POST body on each probe. If no file is provided, a default ~10KB payload is used.

## Logs

Logs are written to `./logs/probes.log` and stdout.

```
tail -f ./logs/probes.log
```

```
[2026-02-10T12:00:00.000Z] dubai -> eu-north-1 | 87.12 ms | status=200
[2026-02-10T12:00:05.000Z] dubai -> us-east-1 | 142.35 ms | status=200
```

## Endpoint

`POST /return` — accepts any JSON body, responds with:

```json
{"node":"dubai","received_at":1707566400000}
```

## Architecture

Deploy one instance per machine. Each node probes all others listed in `TARGETS`. Nodes without a public IP can still probe others — just don't add them to other nodes' `TARGETS`.

```
almaty ----> dubai
almaty ----> eu-north-1
almaty ----> us-east-1
dubai  ----> eu-north-1
dubai  ----> us-east-1
eu-north-1 -> dubai
eu-north-1 -> us-east-1
us-east-1 -> dubai
us-east-1 -> eu-north-1
```
