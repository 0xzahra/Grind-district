# Grind District analytics on Dune

Dune cannot read Supabase directly. Export events to CSV and upload them as a Dune dataset:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-events.mjs 2026-10-01 > events.csv
# Dune -> Create -> Upload dataset -> events.csv  (table becomes dune.<team>.dataset_grind_events)
```

Columns: id, name, anon_id, session_id, src, ref, utm_source, utm_campaign, props (JSON), created_at.

## Queries (replace `dataset_grind_events` with your uploaded table)

**D1 / D30 retention by first-visit cohort**
```sql
with first as (
  select anon_id, date_trunc('day', min(cast(created_at as timestamp))) as cohort
  from dataset_grind_events where name = 'first_visit' group by 1
), active as (
  select distinct anon_id, date_trunc('day', cast(created_at as timestamp)) as day
  from dataset_grind_events where name = 'session_start'
)
select f.cohort,
  count(distinct f.anon_id) as users,
  count(distinct case when a.day = f.cohort + interval '1' day then a.anon_id end) * 1.0 / count(distinct f.anon_id) as d1,
  count(distinct case when a.day = f.cohort + interval '30' day then a.anon_id end) * 1.0 / count(distinct f.anon_id) as d30
from first f left join active a on a.anon_id = f.anon_id
group by 1 order by 1;
```

**Signups by src**
```sql
select coalesce(nullif(src, ''), 'direct') as src, count(*) as signups
from dataset_grind_events where name = 'signup' group by 1 order by 2 desc;
```

**Courses completed (per day and per course)**
```sql
select date_trunc('day', cast(created_at as timestamp)) as day,
  json_extract_scalar(props, '$.course') as course, count(*) as completions
from dataset_grind_events where name = 'course_complete' group by 1, 2 order by 1;
```

**CV and certificate shares**
```sql
select date_trunc('day', cast(created_at as timestamp)) as day, name, count(*) as shares
from dataset_grind_events where name in ('cv_shared', 'cert_shared', 'share_click') group by 1, 2 order by 1;
```

**Transfers (in-game) and top-up attempts**
```sql
select date_trunc('day', cast(created_at as timestamp)) as day, name, count(*) as n,
  sum(cast(json_extract_scalar(props, '$.amount') as double)) as volume
from dataset_grind_events where name in ('transfer', 'topup_attempt') group by 1, 2 order by 1;
```

## Dashboard plan
1. Counters: total players, signups (7d), courses completed (7d), CV shares (7d).
2. Line: daily sessions and signups.
3. Cohort table: D1 / D30 retention.
4. Bar: signups by src (profile, cv, cert, invite, direct).
5. Bar: completions by course.
6. Line: transfers and top-up attempts per day.

Refresh by re-exporting the CSV and replacing the dataset (daily, or after campaigns).
