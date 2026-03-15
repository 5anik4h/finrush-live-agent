import os
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """
    Initializes and returns a Supabase client configured with the service role key.
    This client bypasses RLS if used globally without auth propagation.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment")

    return create_client(supabase_url, supabase_service_key)

