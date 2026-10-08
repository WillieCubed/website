-- Native reposts expose actors without event dates. Keep the first receipt.
-- This table contains public source identities and no OAuth state.
CREATE TABLE IF NOT EXISTS atproto_response_observations (
  copy_uri TEXT NOT NULL,
  actor_did TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (copy_uri, actor_did),
  CHECK (copy_uri ~ '^at://did:[^/]+/app\.bsky\.feed\.post/[^/]+$'),
  CHECK (actor_did ~ '^did:[a-z]+:[^/]+$')
);
