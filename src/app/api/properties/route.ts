import { createSupabaseServerClient } from "@/lib/supabase/server";

// inside GET/POST after guard.ok
const supabase = await createSupabaseServerClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user?.id) {
  return NextResponse.json(
    { error: "UNAUTHORIZED", message: "A valid session is required.", code: 401 },
    { status: 401 },
  );
}

// GET
const properties = await listProperties({ userId: user.id });

// POST
const result = await createProperty(
  {
    name: String(body.name ?? "").trim(),
    customer: String(body.customer ?? "").trim(),
    address: String(body.address ?? "").trim(),
    city: String(body.city ?? "").trim(),
    type: readPropertyType(body.type),
    status: readPropertyStatus(body.status),
    primarySystem: String(body.primarySystem ?? "").trim(),
  },
  { userId: user.id },
);