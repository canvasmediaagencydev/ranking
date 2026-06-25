-- Provenance source for the portfolio "Collection" page.
-- Numbered 0027 to sit after the Drop System migration (0026, PR #40). These are
-- read-only `create or replace` views depending only on photos + season_winners,
-- so they are order-independent and safe to re-run; renumber freely if needed.
--
-- The original spec referenced objects that DO NOT exist in the live schema:
--   weekly_top3 (table)        -> built here as a VIEW (top-3 photos per week)
--   season_winners.rank        -> season_winners has one winner per category,
--                                 so we expose season_winner (bool) + category
--   photos.peak_goscore        -> mapped to the real column peak_pulse
--   photos.tier                -> mapped to the real column badge

-- Weekly top-3 photos by pulse, per ISO week (no weekly_top3 table existed).
create or replace view public.weekly_top3
  with (security_invoker = on) as
select photo_id from (
  select
    id as photo_id,
    row_number() over (
      partition by date_trunc('week', uploaded_at)
      order by pulse desc nulls last
    ) as rn
  from public.photos
  where status = 'published' and is_hidden = false
) ranked
where rn <= 3;

-- Per-photo permanent achievement record (provenance).
create or replace view public.photo_provenance
  with (security_invoker = on) as
select
  p.id                       as photo_id,
  (wt.photo_id is not null)  as weekly_top3,     -- spec: weekly
  p.pick_type,
  (sw.photo_id is not null)  as season_winner,   -- spec: season_rank (no rank column exists)
  sw.category                as season_category,
  p.peak_pulse               as peak_goscore,     -- spec: peak_goscore -> peak_pulse
  p.badge                    as tier              -- spec: tier -> badge
from public.photos p
left join public.weekly_top3 wt on wt.photo_id = p.id
left join public.season_winners sw on sw.photo_id = p.id;

grant select on public.weekly_top3 to anon, authenticated;
grant select on public.photo_provenance to anon, authenticated;
