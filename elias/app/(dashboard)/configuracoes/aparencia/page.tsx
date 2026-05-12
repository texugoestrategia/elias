import { createClient } from "@/lib/supabase/server"
import { AppearanceSettings } from "@/components/settings/appearance-settings"
import { DEFAULT_PREFERENCES } from "@/lib/preferences/theme"

export default async function AparenciaPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = user
    ? await supabase
        .from("user_preferences")
        .select("theme_mode,accent,accent_custom_hsl,bg_type,bg_color,bg_image_url,font_scale,dense_mode")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null }

  const initial = { ...DEFAULT_PREFERENCES, ...(data ?? {}) }

  return <AppearanceSettings initial={initial as any} />
}
