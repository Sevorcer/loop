CREATE TABLE job_change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  job_id uuid NOT NULL REFERENCES jobs(id),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'declined')),
  created_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON job_change_orders
  FOR ALL USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_job_change_orders_job ON job_change_orders(job_id);
CREATE INDEX idx_job_change_orders_org ON job_change_orders(org_id);
