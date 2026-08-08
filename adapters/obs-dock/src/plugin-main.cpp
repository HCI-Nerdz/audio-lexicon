/*
 * audio-lexicon OBS dock — OUT OF TREE.
 * Do NOT submit this plugin to the OBS Project.
 */
#include "lexicon-dock.hpp"

#if defined(HAS_OBS) && HAS_OBS
#include <obs-module.h>
#include <obs-frontend-api.h>

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE("audio-lexicon-obs", "en-US")

MODULE_EXPORT const char *obs_module_description(void) {
  return "Audio Lexicon literacy dock (HCI Nerdz; not for OBS upstream)";
}

MODULE_EXPORT const char *obs_module_name(void) {
  return "Audio Lexicon";
}

bool obs_module_load(void) {
  auto *dock = new LexiconDock();
  obs_frontend_add_dock_by_id("audio_lexicon_dock", "Audio Lexicon", dock);
  blog(LOG_INFO, "[audio-lexicon-obs] loaded v%s (NOT FOR UPSTREAM)", PLUGIN_VERSION);
  return true;
}

void obs_module_unload(void) {}
#else
// Stub entry when OBS SDK is absent — keeps the translation unit valid for CI smoke.
#include <cstdio>
int audio_lexicon_obs_stub_main() {
  std::printf("audio-lexicon-obs %s stub (OBS SDK not linked)\n", PLUGIN_VERSION);
  return 0;
}
#endif
