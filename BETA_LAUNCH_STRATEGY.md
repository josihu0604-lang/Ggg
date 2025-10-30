# ZZIK v2 Beta Launch Strategy

## Executive Summary

Phased rollout approach to minimize risk, validate metrics, and iterate rapidly based on real user feedback.

## Launch Timeline

### Phase 1: Gangnam Beta (Weeks 1-2)
- **Target**: 50 merchants, 5,000 users
- **Geography**: Seoul Gangnam-gu only
- **Goal**: Validate core functionality and unit economics

### Phase 2: Seoul Expansion (Weeks 3-4)
- **Target**: 200 merchants, 20,000 users
- **Geography**: Seoul all districts
- **Goal**: Test scalability and retention metrics

### Phase 3: Metropolitan (Month 2)
- **Target**: 500 merchants, 50,000 users
- **Geography**: Seoul + Incheon + Gyeonggi
- **Goal**: Achieve breakeven, validate growth model

### Phase 4: National Launch (Month 3+)
- **Target**: 2,000+ merchants, 200,000+ users
- **Geography**: All major cities
- **Goal**: Scale to profitability

## Phase 1 Details: Gangnam Beta

### Merchant Onboarding

**Target Segments**:
1. Cafes & Restaurants (60%)
2. Retail Stores (25%)
3. Entertainment Venues (15%)

**Selection Criteria**:
- High foot traffic location
- Existing customer base >100/day
- Willing to offer attractive rewards
- Tech-savvy owner/staff

**Onboarding Process**:
1. Personal pitch meeting (30 min)
2. Demo & training (20 min)
3. QR code installation (10 min)
4. First campaign setup (15 min)
5. Follow-up check-in (Day 3, Day 7)

### User Acquisition

**Channels**:
1. **Local Influencers** (40% budget)
   - Gangnam lifestyle bloggers
   - Instagram micro-influencers (10K-50K followers)
   - Target: 2,000 downloads

2. **Guerrilla Marketing** (30% budget)
   - Street teams at subway stations
   - Flyers at partner merchants
   - Target: 1,500 downloads

3. **Digital Ads** (20% budget)
   - Instagram/Facebook geo-targeted
   - Naver/Kakao local ads
   - Target: 1,000 downloads

4. **Referral Program** (10% budget)
   - Invite 3 friends → 1 free PREMIUM month
   - Target: 500 downloads

### Success Metrics (Phase 1)

**Must-Have** (Go/No-Go Criteria):
- [ ] Check-in success rate >90%
- [ ] Fraud detection false positive <5%
- [ ] App crash rate <0.1%
- [ ] Merchant satisfaction (NPS) >40

**Target Metrics**:
- [ ] DOCV (Deal-to-Check-in): >15%
- [ ] 7-day retention: >35%
- [ ] Daily Active Users: 40% of installs
- [ ] PREMIUM conversion: >10%
- [ ] Average check-ins per user: >5/month

**Unit Economics**:
- [ ] CAC (user): <₩20,000
- [ ] CAC (merchant): <₩50,000
- [ ] LTV:CAC ratio: >3:1
- [ ] Gross margin: >90%

### Risk Mitigation

**Technical Risks**:
1. GPS accuracy issues → QR code fallback tested
2. Database performance → Load testing completed
3. Stripe integration → Sandbox testing required

**Business Risks**:
1. Low merchant engagement → Weekly check-ins
2. Poor user retention → Streak system activated
3. High fraud rate → 5-layer detection + anomaly alerts

**Operational Risks**:
1. Support overload → FAQ + chatbot ready
2. Payment failures → Manual reconciliation process
3. Legal issues → ToS/Privacy Policy reviewed

## Decision Points

### Week 1 Review
- **Go**: Metrics on track, scale to 100 merchants
- **Iterate**: Issues found, fix and retest
- **No-Go**: Critical failures, pause and pivot

### Week 2 Review
- **Go to Phase 2**: All must-have metrics met
- **Extend Phase 1**: Close but needs more data
- **Rollback**: Fundamental issues, back to design

## Launch Checklist

### T-7 Days (1 Week Before)
- [ ] 50 merchants confirmed and trained
- [ ] QR codes printed and delivered
- [ ] Marketing materials prepared
- [ ] Influencer posts scheduled
- [ ] Support team briefed
- [ ] Monitoring dashboards live
- [ ] Incident response plan activated

### T-1 Day (Day Before)
- [ ] Final smoke tests passing
- [ ] Database backup verified
- [ ] Rollback plan tested
- [ ] On-call rotation confirmed
- [ ] Press release ready (if needed)

### T+0 (Launch Day)
- [ ] App store listing live
- [ ] Marketing campaigns activated
- [ ] Real-time monitoring active
- [ ] Team standby for issues
- [ ] First check-ins verified

### T+1 Day (Day After)
- [ ] Metrics dashboard reviewed
- [ ] Error logs analyzed
- [ ] User feedback collected
- [ ] Merchant feedback calls
- [ ] Quick fixes deployed if needed

## Communication Plan

### Internal
- Daily standup (10 min)
- Weekly metrics review (30 min)
- Slack channel: #beta-launch-gangnam
- Emergency escalation: PagerDuty

### External
- Merchant: Weekly newsletter + personal calls
- Users: In-app announcements + push notifications
- Press: PR agency coordinated (if funded)
- Investors: Bi-weekly update email

## Budget (Phase 1)

| Category | Amount | Notes |
|----------|--------|-------|
| Marketing | ₩5,000,000 | Influencers, ads, materials |
| Merchant Incentives | ₩3,000,000 | First campaign subsidies |
| Operations | ₩2,000,000 | Support, tools |
| **Total** | **₩10,000,000** | 2-week budget |

**Expected ROI**:
- 5,000 users × 10% PREMIUM = 500 premium users
- 500 × ₩9,900 = ₩4,950,000 MRR
- Payback period: 2 months

## Post-Launch Activities

### Week 1-2: Stabilization
- Fix critical bugs
- Respond to user feedback
- Optimize conversion funnels
- A/B test onboarding flow

### Week 3-4: Optimization
- Improve retention features
- Enhance merchant dashboards
- Add requested features
- Prepare for Phase 2 expansion

## Pivot Criteria

If Phase 1 fails to meet minimum criteria:

**Option A: Iterate** (2-4 weeks)
- Fix identified issues
- Retest with smaller cohort
- Adjust pricing/features

**Option B: Pivot** (1-2 months)
- Different target audience
- Different value proposition
- Different business model

**Option C: Shutdown** (immediate)
- Return remaining funds to investors
- Preserve team reputation
- Document learnings

## Contact

- **Launch Lead**: @launch-lead
- **Tech Lead**: @tech-lead
- **Marketing Lead**: @marketing-lead
- **Emergency**: See incident response playbook
