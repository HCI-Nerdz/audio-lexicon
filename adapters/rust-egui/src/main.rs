use eframe::egui;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize)]
struct Lexicon {
    version: String,
    tree: Vec<TreeNode>,
    terms: HashMap<String, Term>,
}

#[derive(Debug, Clone, Deserialize)]
struct TreeNode {
    label: String,
    #[serde(rename = "termId")]
    term_id: Option<String>,
    children: Option<Vec<TreeNode>>,
}

#[derive(Debug, Clone, Deserialize)]
struct Term {
    id: Option<String>,
    name: String,
    summary: String,
    #[serde(rename = "plainMeaning")]
    plain_meaning: String,
    history: String,
    #[serde(rename = "whenToUse")]
    when_to_use: String,
    #[serde(rename = "commonConfusion")]
    common_confusion: String,
    exports: Exports,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct Exports {
    #[serde(rename = "equalizerApo")]
    equalizer_apo: Option<String>,
    obs: Option<serde_json::Value>,
}

struct App {
    lexicon: Lexicon,
    query: String,
    selected: String,
}

fn catalog_path() -> PathBuf {
    if let Ok(p) = env::var("AUDIO_LEXICON_CATALOG") {
        return PathBuf::from(p);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../catalog/lexicon.json")
}

impl App {
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let mut style = (*cc.egui_ctx.style()).clone();
        style.visuals = egui::Visuals::light();
        cc.egui_ctx.set_style(style);
        let raw = fs::read_to_string(catalog_path()).expect("catalog");
        let lexicon: Lexicon = serde_json::from_str(&raw).expect("parse");
        let selected = if lexicon.terms.contains_key("home") {
            "home".into()
        } else if lexicon.terms.contains_key("peaking-eq") {
            "peaking-eq".into()
        } else {
            lexicon.terms.keys().next().cloned().unwrap_or_default()
        };
        Self {
            lexicon,
            query: String::new(),
            selected,
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::SidePanel::left("tree").resizable(true).show(ctx, |ui| {
            ui.label("HCI Nerdz · Audio lexicon (egui)");
            ui.text_edit_singleline(&mut self.query);
            ui.separator();
            egui::ScrollArea::vertical().show(ui, |ui| {
                let q = self.query.to_lowercase();
                for cat in &self.lexicon.tree {
                    if let Some(id) = &cat.term_id {
                        if q.is_empty()
                            || cat.label.to_lowercase().contains(&q)
                            || id.to_lowercase().contains(&q)
                        {
                            if ui
                                .selectable_label(self.selected == *id, format!("★ {}", cat.label))
                                .clicked()
                            {
                                self.selected = id.clone();
                            }
                        }
                        ui.add_space(6.0);
                        continue;
                    }
                    ui.strong(&cat.label);
                    if let Some(children) = &cat.children {
                        for child in children {
                            if let Some(id) = &child.term_id {
                                if !q.is_empty()
                                    && !child.label.to_lowercase().contains(&q)
                                    && !id.to_lowercase().contains(&q)
                                {
                                    continue;
                                }
                                if ui
                                    .selectable_label(self.selected == *id, &child.label)
                                    .clicked()
                                {
                                    self.selected = id.clone();
                                }
                            }
                        }
                    }
                    ui.add_space(6.0);
                }
            });
        });

        egui::CentralPanel::default().show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                if let Some(t) = self.lexicon.terms.get(&self.selected) {
                    let is_home = t.id.as_deref() == Some("home") || self.selected == "home";
                    ui.heading(&t.name);
                    ui.label(&t.summary);
                    ui.add_space(8.0);
                    ui.label(format!("{}: {}", if is_home { "Why" } else { "Meaning" }, t.plain_meaning));
                    ui.label(format!("{}: {}", if is_home { "Project" } else { "History" }, t.history));
                    ui.label(format!("{}: {}", if is_home { "How" } else { "When" }, t.when_to_use));
                    ui.label(format!("{}: {}", if is_home { "Not" } else { "Confusion" }, t.common_confusion));
                    ui.separator();
                    if is_home {
                        ui.heading("Links");
                        ui.hyperlink("https://github.com/HCI-Nerdz/audio-lexicon");
                    } else {
                        ui.heading("Export");
                        match (&t.exports.equalizer_apo, &t.exports.obs) {
                            (None, None) => ui.label("Conceptual only — no EqualizerAPO / OBS map."),
                            (apo, obs) => {
                                if let Some(a) = apo {
                                    ui.monospace(a);
                                }
                                if let Some(o) = obs {
                                    ui.monospace(serde_json::to_string_pretty(o).unwrap_or_default());
                                }
                                ui.label("")
                            }
                        };
                    }
                    ui.separator();
                    ui.small(format!(
                        "About: audio-lexicon-egui {} · catalog {}",
                        env!("CARGO_PKG_VERSION"),
                        self.lexicon.version
                    ));
                }
            });
        });
    }
}

fn main() -> eframe::Result {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default().with_inner_size([1100.0, 720.0]),
        ..Default::default()
    };
    eframe::run_native(
        "audio-lexicon (egui)",
        options,
        Box::new(|cc| Ok(Box::new(App::new(cc)))),
    )
}
