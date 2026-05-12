import { createClient } from "@/lib/supabase/server"
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences/theme"

export async function getUserPreferences(): Promise<UserPreferences> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return DEFAULT_PREFERENCES

  const { data } = await supabase
    .from("user_preferences")
    .select("theme_mode,accent,accent_custom_hsl,bg_type,bg_color,bg_image_url,font_scale,dense_mode")
    .eq("user_id", user.id)
    .maybeSingle()

  return { ...DEFAULT_PREFERENCES, ...(data ?? {}) } as UserPreferences
}

export async function getUserLayout(key: string): Promise<any | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from("user_layouts").select("value").eq("user_id", user.id).eq("key", key).maybeSingle()
  return data?.value ?? null
}
