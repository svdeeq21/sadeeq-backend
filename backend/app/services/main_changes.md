# Changes needed in main.py
# Add these lines to wire up the scheduler on startup/shutdown

# At the top, add this import:
from app.services.scheduler import start_scheduler, stop_scheduler

# Replace your existing @app.on_event("startup") with:
@app.on_event("startup")
async def startup_event():
    start_scheduler()

# Replace your existing @app.on_event("shutdown") with:
@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()

# ─────────────────────────────────────────────────────────────────
# Changes needed in message_pipeline.py
# Add reply tracking — when a lead replies, increment their variant's counter
# Add this block right after "lead = lead_result.data[0]" line:

# Track reply against outreach variant (for A/B testing)
outreach_variant = lead.get("outreach_variant")
if outreach_variant and lead.get("status") == "OUTREACH_SENT":
    try:
        db.rpc("increment_variant_replies", {"p_variant_id": outreach_variant}).execute()
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────
# Changes needed in Google Sheet
# Add two new columns after G (Source):
#   H - Business Name
#   I - Industry
# Then shift Status to J, Lead ID to K, Synced At to L
