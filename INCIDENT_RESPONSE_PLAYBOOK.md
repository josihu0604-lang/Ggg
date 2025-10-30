# Incident Response Playbook

## Severity Levels

### P0 - CRITICAL (Immediate Response)
- **Definition**: Complete service outage, data breach, or payment system failure
- **Response Time**: <5 minutes
- **Example**: Database down, all check-ins failing, payment processing stopped

### P1 - HIGH (Urgent Response)
- **Definition**: Major feature broken, affecting >10% of users
- **Response Time**: <15 minutes
- **Example**: GPS check-in failing, QR codes not working, subscription cancellation broken

### P2 - MEDIUM (Same Day Response)
- **Definition**: Minor feature issues, affecting <10% of users
- **Response Time**: <2 hours
- **Example**: Streak calculation incorrect, metrics dashboard broken

### P3 - LOW (Next Business Day)
- **Definition**: Cosmetic issues, low-impact bugs
- **Response Time**: <24 hours
- **Example**: UI glitch, typo, minor performance degradation

## Incident Response Process

### 1. DETECT (Automated + Manual)

**Automated Alerts**:
- Sentry error rate spike (>10 errors/minute)
- Prometheus metrics anomaly (API latency >2s)
- Check-in success rate <90%
- Database connection pool exhaustion

**Manual Detection**:
- Customer support reports
- Social media mentions
- Merchant complaints
- Internal testing

### 2. TRIAGE (5 minutes)

**Questions to Answer**:
1. What is broken?
2. How many users affected?
3. Is data at risk?
4. Is money involved?
5. What is the severity?

**Immediate Actions**:
- Create Slack incident channel (#incident-YYYYMMDD-description)
- Page on-call engineer (PagerDuty)
- Update status page (status.zzik.app)
- Start incident log (shared Google Doc)

### 3. RESPOND (15-60 minutes)

**Response Team**:
- **Incident Commander**: Coordinates response
- **Tech Lead**: Investigates root cause
- **Customer Support**: Handles user communication
- **Product Manager**: Business decisions

**Investigation Steps**:
1. Check monitoring dashboards
2. Review recent deployments
3. Analyze error logs (Sentry)
4. Query database for anomalies
5. Test affected features manually

**Communication**:
- Internal: Slack incident channel
- External: Status page + in-app notification
- Merchants: Email if revenue-impacting

### 4. RESOLVE (Variable)

**Quick Fixes** (P0/P1):
- Rollback recent deployment
- Restart failed services
- Scale up infrastructure
- Apply hotfix patch
- Enable maintenance mode

**Root Cause Fix** (P2/P3):
- Write comprehensive fix
- Code review
- Testing (unit + integration)
- Gradual rollout
- Monitor for recurrence

### 5. COMMUNICATE (Ongoing)

**During Incident**:
- Status page updates every 30 minutes
- Slack channel updates every 15 minutes
- Customer support scripts provided

**After Resolution**:
- "Incident resolved" announcement
- ETA for full post-mortem (48 hours)
- Thank affected users (if applicable)

### 6. POST-MORTEM (Within 48 hours)

**Required Sections**:
1. **Timeline**: What happened when
2. **Root Cause**: Why it happened
3. **Impact**: Who was affected
4. **Resolution**: How we fixed it
5. **Action Items**: How we prevent recurrence
6. **Lessons Learned**: What we learned

**No Blame Culture**:
- Focus on systems, not people
- Blameless post-mortems
- Celebrate good response
- Share learnings company-wide

## Common Incidents & Runbooks

### Incident: Database Connection Pool Exhaustion

**Symptoms**:
- API requests timing out
- "Connection pool exhausted" errors
- Sentry alert: Database connection errors

**Immediate Actions**:
1. Check active connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
   ```

2. Kill long-running queries:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'active' AND now() - query_start > interval '5 minutes';
   ```

3. Scale up connection pool:
   ```bash
   # Increase max connections in database.yml
   max_connections: 200  # from 100
   ```

4. Restart application servers

**Root Cause**: Usually connection leaks or sudden traffic spike

**Prevention**:
- Add connection pool monitoring
- Set shorter idle timeouts
- Implement connection retry logic

### Incident: Stripe Webhook Failures

**Symptoms**:
- Subscription status not updating
- Payment confirmation delayed
- Sentry alert: Webhook signature verification failed

**Immediate Actions**:
1. Check Stripe Dashboard webhook logs
2. Verify webhook secret hasn't changed
3. Check StripeWebhookEvent table for failed events
4. Manually trigger webhook retry in Stripe

**Root Cause**: Signature verification issues, network timeouts

**Prevention**:
- Webhook event queue + retry mechanism
- Monitor webhook success rate
- Alert on webhook failures >10/hour

### Incident: Fraud Detection False Positives

**Symptoms**:
- User complaints about valid check-ins rejected
- Check-in success rate <90%
- Sentry alert: High fraud detection rate

**Immediate Actions**:
1. Check fraud score distribution:
   ```sql
   SELECT AVG(fraudScore), COUNT(*) 
   FROM "ValidatedCheckIn" 
   WHERE checkedAt > now() - interval '1 hour' 
   GROUP BY verified;
   ```

2. Temporarily lower fraud threshold:
   ```typescript
   // fraud.service.ts
   const FRAUD_THRESHOLD = 0.7; // from 0.5
   ```

3. Investigate specific user cases
4. Enable QR code fallback for affected users

**Root Cause**: GPS accuracy issues, H3 cell boundary edge cases

**Prevention**:
- Tune fraud detection thresholds
- Improve GPS accuracy requirements
- Better handling of indoor locations

### Incident: Rate Limiting Too Aggressive

**Symptoms**:
- User complaints about "too many requests"
- Check-in success rate drops
- Sentry alert: Rate limit exceeded

**Immediate Actions**:
1. Check Redis rate limit keys:
   ```bash
   redis-cli KEYS "rate_limit:checkin:*"
   ```

2. Temporarily increase limits:
   ```typescript
   // rate-limit.util.ts
   CHECKIN_HOURLY: { count: 20, window: 3600 } // from 10
   ```

3. Reset rate limits for affected users:
   ```typescript
   await resetRateLimit(userId, 'checkin');
   ```

**Root Cause**: Limits set too conservatively

**Prevention**:
- Monitor rate limit hit rate
- A/B test different thresholds
- Implement per-tier rate limits

## Escalation

### Level 1: On-Call Engineer
- Handles P2/P3 incidents
- Escalates if needed

### Level 2: Tech Lead
- Handles P1 incidents
- Makes architectural decisions

### Level 3: CTO
- Handles P0 incidents
- Makes business decisions
- Coordinates with CEO/investors

### Level 4: CEO
- Handles PR disasters
- Makes company-level decisions

## Tools & Access

### Monitoring
- **Sentry**: https://sentry.io/zzik
- **Prometheus**: http://prometheus.zzik.internal
- **Grafana**: http://grafana.zzik.internal

### Infrastructure
- **AWS Console**: Production access
- **Database**: Read/write access
- **Redis**: Admin access

### Communication
- **Slack**: #incidents channel
- **PagerDuty**: On-call rotation
- **Status Page**: status.zzik.app

## Contact List

| Role | Name | Phone | Email |
|------|------|-------|-------|
| CTO | @cto | +82-10-XXXX-XXXX | cto@zzik.app |
| Tech Lead | @tech-lead | +82-10-XXXX-XXXX | tech@zzik.app |
| DevOps | @devops | +82-10-XXXX-XXXX | devops@zzik.app |
| Support Lead | @support | +82-10-XXXX-XXXX | support@zzik.app |

## Post-Incident Checklist

- [ ] Incident resolved and verified
- [ ] Status page updated
- [ ] Customers notified
- [ ] Monitoring restored
- [ ] Post-mortem scheduled
- [ ] Action items created
- [ ] Documentation updated
- [ ] Team debriefed

## Templates

### Status Page Update Template
```
[INVESTIGATING] We are currently investigating an issue affecting check-ins. 
Our team is working to resolve this as quickly as possible.

Last updated: YYYY-MM-DD HH:MM KST
```

### Customer Communication Template
```
Hi there,

We experienced an issue with [feature] on [date] from [time] to [time] KST.

What happened: [brief explanation]
Impact: [who was affected]
Resolution: [what we did]

We apologize for any inconvenience. If you experienced issues during this time, 
please contact support@zzik.app and we'll make it right.

Best regards,
ZZIK Team
```

## Version History

- v1.0 (2025-10-29): Initial version
- Updates: After each major incident
