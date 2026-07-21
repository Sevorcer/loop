-- =============================================================================
-- Fixture: Wave 2 Domains — Baseline
-- Sprint 27 PR A (#56)
--
-- Seeds crews, dispatch_plans, crew_assignments, schedule_blocks,
-- dispatch_events, technical_profiles, and installed_systems for the
-- default development org.
--
-- All IDs follow the pattern: 00000000-0000-<domain>-8000-<seq>
--   domain: 4500 = crews
--           4600 = dispatch_plans
--           4700 = crew_assignments
--           4800 = schedule_blocks
--           4900 = dispatch_events
--           5000 = technical_profiles
--           5100 = installed_systems
-- =============================================================================

DO $$
BEGIN
  -- Only seed if Wave 2 tables exist (post-migration guard)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'crews'
  ) THEN
    RAISE NOTICE 'Wave 2 tables not found. Skipping Wave 2 baseline fixture.';
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- Crews
  -- -------------------------------------------------------------------------

  INSERT INTO crews (id, org_id, name, lead_installer, members, certifications, availability, truck_name)
  VALUES
    (
      '00000000-0000-4500-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      'Rivera Install Crew',
      'Marcus Rivera',
      '[{"id":"tech-marcus-rivera","name":"Marcus Rivera","role":"lead"},{"id":"tech-elena-cruz","name":"Elena Cruz","role":"installer"}]'::jsonb,
      ARRAY['Heat Pump','Rigging','Startup'],
      'available',
      'Install Truck 4'
    ),
    (
      '00000000-0000-4500-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      'Brooks Service Crew',
      'Tina Brooks',
      '[{"id":"tech-tina-brooks","name":"Tina Brooks","role":"lead"},{"id":"tech-maya-singh","name":"Maya Singh","role":"installer"}]'::jsonb,
      ARRAY['Service','EPA Universal'],
      'available',
      'Service Van 2'
    ),
    (
      '00000000-0000-4500-8000-000000000003',
      '00000000-0000-4000-8000-000000000001',
      'Lee Commercial Crew',
      'Jordan Lee',
      '[{"id":"tech-jordan-lee","name":"Jordan Lee","role":"lead"},{"id":"tech-chris-doyle","name":"Chris Doyle","role":"apprentice"}]'::jsonb,
      ARRAY['Commercial','Rigging','Startup','Chiller'],
      'available',
      'Service Truck 7'
    )
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Dispatch Plans (linked to baseline jobs where possible)
  -- -------------------------------------------------------------------------

  INSERT INTO dispatch_plans (id, org_id, job_id, job_number, customer_name, property_name, job_type, dispatch_status, dispatchability, target_date, estimated_duration_hours, priority, constraints)
  VALUES
    (
      '00000000-0000-4600-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4201-8000-000000000001',
      'JOB-2001',
      'Clearwater Commercial Group',
      'Clearwater Building C',
      'Install',
      'ready_to_schedule',
      '{"isDispatchable":true,"materialReadiness":{"state":"satisfied","reason":"All materials staged."},"technicalReadiness":{"state":"satisfied","reason":"Profile complete."},"customerReadiness":{"state":"satisfied","reason":"Customer confirmed."},"crewReadiness":{"state":"satisfied","reason":"Crew available."}}'::jsonb,
      '2026-07-22',
      8,
      'high',
      '[]'::jsonb
    ),
    (
      '00000000-0000-4600-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4201-8000-000000000002',
      'JOB-2002',
      'Metro Transit Authority',
      'Metro Station B',
      'Service',
      'awaiting_crew_availability',
      '{"isDispatchable":false,"materialReadiness":{"state":"satisfied","reason":"Parts in stock."},"technicalReadiness":{"state":"satisfied","reason":"Scope confirmed."},"customerReadiness":{"state":"satisfied","reason":"Window confirmed."},"crewReadiness":{"state":"not_satisfied","reason":"No qualified crew available this week."}}'::jsonb,
      '2026-07-24',
      4,
      'normal',
      '[]'::jsonb
    )
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Crew Assignments
  -- -------------------------------------------------------------------------

  INSERT INTO crew_assignments (id, org_id, dispatch_plan_id, job_id, crew_id, crew_name, lead_installer, supporting_technicians, status, assigned_at, reassignment_history)
  VALUES
    (
      '00000000-0000-4700-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4600-8000-000000000001',
      '00000000-0000-4201-8000-000000000001',
      '00000000-0000-4500-8000-000000000001',
      'Rivera Install Crew',
      'Marcus Rivera',
      ARRAY['Elena Cruz'],
      'confirmed',
      '2026-07-20T10:00:00Z',
      '[]'::jsonb
    )
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Schedule Blocks
  -- -------------------------------------------------------------------------

  INSERT INTO schedule_blocks (id, org_id, dispatch_plan_id, job_id, crew_assignment_id, crew_name, scheduled_date, scheduled_start_time, scheduled_end_time, estimated_duration_hours, job_type, customer_name, property_name, dispatch_status)
  VALUES
    (
      '00000000-0000-4800-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4600-8000-000000000001',
      '00000000-0000-4201-8000-000000000001',
      '00000000-0000-4700-8000-000000000001',
      'Rivera Install Crew',
      '2026-07-22',
      '07:00',
      '15:00',
      8,
      'Install',
      'Clearwater Commercial Group',
      'Clearwater Building C',
      'scheduled'
    )
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Dispatch Events
  -- -------------------------------------------------------------------------

  INSERT INTO dispatch_events (id, org_id, dispatch_plan_id, type, timestamp, description)
  VALUES
    (
      '00000000-0000-4900-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4600-8000-000000000001',
      'dispatch_plan_created',
      '2026-07-20T10:00:00Z',
      'Dispatch plan created for JOB-2001 — Clearwater Building C.'
    ),
    (
      '00000000-0000-4900-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4600-8000-000000000001',
      'crew_assigned',
      '2026-07-20T10:05:00Z',
      'Rivera Install Crew assigned to JOB-2001.'
    )
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Technical Profiles
  -- -------------------------------------------------------------------------

  INSERT INTO technical_profiles (id, org_id, technical_identity_id, system_name, manufacturer, equipment_type, catalog_entry_ids, match_state, match_confidence, permit_fields, known_facts, discovered_facts)
  VALUES
    (
      '00000000-0000-5000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      'ti-clearwater-heat-pump-1',
      'Clearwater Bldg C HVAC System',
      'Daikin',
      'Heat Pump',
      ARRAY['catalog-daikin-outdoor-36'],
      'exact',
      0.99,
      '{"ahriNumber":"208774501","coolingCapacityBtu":36000,"heatingCapacityBtu":38000,"seer2":16.4,"voltage":"208/230V-1-60","mca":"23.1A","mocp":"35A","refrigerant":"R-410A","fuelType":"Electric"}'::jsonb,
      '[{"id":"ahri-1","label":"AHRI","value":"208774501"},{"id":"voltage-1","label":"Voltage","value":"208/230V-1-60"}]'::jsonb,
      '[]'::jsonb
    )
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Installed Systems
  -- -------------------------------------------------------------------------

  INSERT INTO installed_systems (id, org_id, technical_identity_id, technical_profile_id, system_name, lifecycle_status, customer_name, property_name, location, job_id, job_number, match_state, match_confidence, install_date, serial_numbers, accessories, linked_workflow_ids, permit_ready)
  VALUES
    (
      '00000000-0000-5100-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      'ti-clearwater-heat-pump-1',
      '00000000-0000-5000-8000-000000000001',
      'Clearwater Bldg C HVAC System',
      'Planned',
      'Clearwater Commercial Group',
      'Clearwater Building C',
      'Rooftop — West Wing',
      '00000000-0000-4201-8000-000000000001',
      'JOB-2001',
      'exact',
      0.99,
      '2026-07-22',
      ARRAY[]::text[],
      ARRAY[]::text[],
      ARRAY['00000000-0000-4201-8000-000000000001'],
      false
    )
  ON CONFLICT (id) DO NOTHING;

END $$;
