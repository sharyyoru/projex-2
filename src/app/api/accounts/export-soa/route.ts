import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const format = searchParams.get("format") || "csv";

  if (!clientId) {
    return NextResponse.json({ error: "Client ID required" }, { status: 400 });
  }

  try {
    // Fetch client data
    const { data: client, error: clientError } = await supabase
      .from("account_clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch ad-hoc requirements
    const { data: adhocItems } = await supabase
      .from("account_adhoc_requirements")
      .select("*")
      .eq("client_id", clientId)
      .order("date_requested", { ascending: false });

    const adhocTotal = (adhocItems || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const totalFees = (Number(client.retainer_fee) || 0) + (Number(client.service_based_fee) || 0) + adhocTotal;

    // Get current period
    const now = new Date();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = months[now.getMonth()];
    const year = now.getFullYear();

    if (format === "csv") {
      // Generate CSV content
      const lines = [
        `Statement of Account - ${client.client_name}`,
        `Period: ${currentMonth} ${year}`,
        `Generated: ${now.toLocaleDateString()}`,
        "",
        "SERVICE BREAKDOWN",
        "Service,Amount",
        `Retainer Fee,${client.retainer_fee || 0}`,
        `Service Based Fee,${client.service_based_fee || 0}`,
        `Ad-Hoc Total,${adhocTotal}`,
        `TOTAL,${totalFees}`,
        "",
        "AD-HOC REQUIREMENTS",
        "Date Requested,Description,Service Dates,Amount,Status",
      ];

      (adhocItems || []).forEach((item) => {
        const serviceDates = item.service_date_start 
          ? `${item.service_date_start} - ${item.service_date_end || ""}` 
          : "";
        lines.push(`${item.date_requested},${item.description?.replace(/,/g, ";")},${serviceDates},${item.amount || 0},${item.status}`);
      });

      const csvContent = lines.join("\n");
      
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="SOA_${client.client_name.replace(/\s+/g, "_")}_${now.toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // Return JSON for other uses
    return NextResponse.json({
      client: {
        name: client.client_name,
        industry: client.industry,
        contract_type: client.contract_type,
        client_since: client.client_since,
      },
      period: `${currentMonth} ${year}`,
      fees: {
        retainer: Number(client.retainer_fee) || 0,
        serviceBased: Number(client.service_based_fee) || 0,
        adhoc: adhocTotal,
        total: totalFees,
      },
      adhocItems: adhocItems || [],
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Export SOA error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
