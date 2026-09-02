// Fill these in from your Supabase project: Settings -> API
const SUPABASE_URL = "https://rxzqnlsnxthbpctfqpdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4enFubHNueHRoYnBjdGZxcGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTQxNDEsImV4cCI6MjEwMzgzMDE0MX0.yDNxFCyJQ8oQ-6u5OptWTksCVrVp1awWsp75idYx2rM";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
