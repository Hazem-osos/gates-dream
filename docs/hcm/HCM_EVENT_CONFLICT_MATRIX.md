# HCM Event Conflict Matrix

| Scenario | Verdict |
|----------|---------|
| Same-day duplicate assignment events (TRANSFER, PROMOTION, …) | REJECT |
| Same-day duplicate compensation events | REJECT |
| PROMOTION + DEMOTION same effective date | REJECT |
| Event on TERMINATED episode (except REHIRE) | REJECT |
| REHIRE on active episode | REJECT |
| REHIRE on terminated episode | ALLOWED |
| Future assignment after approved termination | REJECT |
| SUSPENSION + TERMINATION same day | REQUIRES_REVIEW |
| Contract event on terminated episode | REJECT |

Implementation: `hcm-event-conflict.service.ts`.
