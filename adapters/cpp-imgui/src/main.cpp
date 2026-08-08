// Minimal Dear ImGui shell for audio-lexicon catalog browsing.
#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"
#include <GLFW/glfw3.h>

#include <fstream>
#include <sstream>
#include <string>
#include <cstring>
#include <cstdlib>
#include <iostream>
#include <algorithm>

static std::string readFile(const std::string &path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) return {};
  std::ostringstream ss;
  ss << in.rdbuf();
  return ss.str();
}

static std::string catalogPath() {
  if (const char *e = std::getenv("AUDIO_LEXICON_CATALOG")) return e;
  return "../../catalog/lexicon.json";
}

struct TermView {
  std::string id, name, summary, meaning, history, when, confusion, apo;
};

// Extremely small extractor for demo purposes — production ports should use a real JSON library.
static std::vector<TermView> parseTermsRough(const std::string &json) {
  std::vector<TermView> out;
  size_t pos = 0;
  while (true) {
    pos = json.find("\"id\":", pos);
    if (pos == std::string::npos) break;
    auto q1 = json.find('"', pos + 5);
    auto q2 = json.find('"', q1 + 1);
    if (q1 == std::string::npos || q2 == std::string::npos) break;
    TermView t;
    t.id = json.substr(q1 + 1, q2 - q1 - 1);
    auto grab = [&](const char *key) {
      auto p = json.find(std::string("\"") + key + "\":", q2);
      if (p == std::string::npos || p > q2 + 8000) return std::string{};
      auto a = json.find('"', p + std::strlen(key) + 3);
      auto b = a;
      while (true) {
        b = json.find('"', b + 1);
        if (b == std::string::npos) return std::string{};
        if (json[b - 1] != '\\') break;
      }
      return json.substr(a + 1, b - a - 1);
    };
    // Only accept objects that look like terms (have plainMeaning nearby)
    if (json.find("\"plainMeaning\"", q2) < q2 + 2000) {
      t.name = grab("name");
      t.summary = grab("summary");
      t.meaning = grab("plainMeaning");
      t.history = grab("history");
      t.when = grab("whenToUse");
      t.confusion = grab("commonConfusion");
      t.apo = grab("equalizerApo");
      if (!t.name.empty()) out.push_back(t);
    }
    pos = q2 + 1;
    if (out.size() > 200) break;
  }
  return out;
}

int main() {
  if (!glfwInit()) return 1;
  const char *glsl = "#version 130";
  glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
  glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 0);
  GLFWwindow *window = glfwCreateWindow(1100, 720, "audio-lexicon (ImGui)", nullptr, nullptr);
  if (!window) return 1;
  glfwMakeContextCurrent(window);
  glfwSwapInterval(1);

  IMGUI_CHECKVERSION();
  ImGui::CreateContext();
  ImGui::StyleColorsLight();
  ImGui_ImplGlfw_InitForOpenGL(window, true);
  ImGui_ImplOpenGL3_Init(glsl);

  const auto raw = readFile(catalogPath());
  auto terms = parseTermsRough(raw);
  std::sort(terms.begin(), terms.end(), [](const TermView &a, const TermView &b) {
    if (a.id == "home") return true;
    if (b.id == "home") return false;
    return a.name < b.name;
  });
  int selected = 0;
  char filterBuf[128] = {};
  bool showAbout = false;

  while (!glfwWindowShouldClose(window)) {
    glfwPollEvents();
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplGlfw_NewFrame();
    ImGui::NewFrame();

    ImGui::Begin("HCI Nerdz · Audio lexicon (ImGui)", nullptr, ImGuiWindowFlags_NoCollapse);
    ImGui::TextUnformatted("Filter tree");
    ImGui::InputText("Search", filterBuf, sizeof filterBuf);
    ImGui::BeginChild("tree", ImVec2(260, 0), true);
    for (int i = 0; i < (int)terms.size(); ++i) {
      if (filterBuf[0] && terms[i].name.find(filterBuf) == std::string::npos &&
          terms[i].id.find(filterBuf) == std::string::npos)
        continue;
      if (ImGui::Selectable(terms[i].name.c_str(), selected == i)) selected = i;
    }
    ImGui::EndChild();
    ImGui::SameLine();
    ImGui::BeginChild("detail", ImVec2(0, 0), false);
    if (!terms.empty()) {
      const auto &t = terms[selected];
      const bool home = t.id == "home";
      ImGui::TextWrapped("%s", t.name.c_str());
      ImGui::Separator();
      ImGui::TextWrapped("Summary: %s", t.summary.c_str());
      ImGui::Spacing();
      ImGui::TextWrapped("%s: %s", home ? "Why" : "Meaning", t.meaning.c_str());
      ImGui::Spacing();
      ImGui::TextWrapped("%s: %s", home ? "Project" : "History", t.history.c_str());
      ImGui::Spacing();
      ImGui::TextWrapped("%s: %s", home ? "How" : "When", t.when.c_str());
      ImGui::Spacing();
      ImGui::TextWrapped("%s: %s", home ? "Not" : "Confusion", t.confusion.c_str());
      if (!home) {
        ImGui::Separator();
        ImGui::TextUnformatted("Export");
        if (t.apo.empty()) ImGui::TextUnformatted("Conceptual only");
        else ImGui::TextWrapped("%s", t.apo.c_str());
      }
    }
    if (ImGui::Button("About")) showAbout = true;
    ImGui::EndChild();
    ImGui::End();

    if (showAbout) {
      ImGui::OpenPopup("About");
      showAbout = false;
    }
    if (ImGui::BeginPopupModal("About", nullptr, ImGuiWindowFlags_AlwaysAutoResize)) {
      ImGui::Text("audio-lexicon %s", APP_VERSION);
      ImGui::Text("Dear ImGui adapter · HCI Nerdz");
      if (ImGui::Button("Close")) ImGui::CloseCurrentPopup();
      ImGui::EndPopup();
    }

    ImGui::Render();
    int w, h;
    glfwGetFramebufferSize(window, &w, &h);
    glViewport(0, 0, w, h);
    glClearColor(0.91f, 0.94f, 0.91f, 1.f);
    glClear(GL_COLOR_BUFFER_BIT);
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
    glfwSwapBuffers(window);
  }

  ImGui_ImplOpenGL3_Shutdown();
  ImGui_ImplGlfw_Shutdown();
  ImGui::DestroyContext();
  glfwDestroyWindow(window);
  glfwTerminate();
  return 0;
}
