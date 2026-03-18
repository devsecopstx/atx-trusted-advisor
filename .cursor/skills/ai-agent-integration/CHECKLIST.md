# ai-agent-integration Checklist

## Validation Checklist


- [ ] Task lifecycle transitions are exhaustive and type-safe
- [ ] Every emitted event includes `taskId` + `correlationId`
- [ ] Polling and SSE both converge to the same final state
- [ ] Cancellation is handled mid-flight without corrupting state
- [ ] UI can recover after disconnect/reconnect with snapshot + replay
