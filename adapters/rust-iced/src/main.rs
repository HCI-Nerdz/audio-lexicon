use iced::widget::{button, column, container, row, scrollable, text, text_input, Column};
use iced::{Element, Length, Task};
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
    id: String,
    label: String,
    #[serde(rename = "termId")]
    term_id: Option<String>,
    children: Option<Vec<TreeNode>>,
}

#[derive(Debug, Clone, Deserialize)]
struct RelatedLink {
    label: String,
    url: String,
    blurb: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct Term {
    id: String,
    name: String,
    summary: String,
    #[serde(rename = "plainMeaning")]
    plain_meaning: String,
    history: String,
    #[serde(rename = "whenToUse")]
    when_to_use: String,
    #[serde(rename = "commonConfusion")]
    common_confusion: String,
    #[serde(default, rename = "relatedLinks")]
    related_links: Vec<RelatedLink>,
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

#[derive(Debug, Clone)]
enum Message {
    Search(String),
    Select(String),
}

fn catalog_path() -> PathBuf {
    if let Ok(p) = env::var("AUDIO_LEXICON_CATALOG") {
        return PathBuf::from(p);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../catalog/lexicon.json")
}

fn load() -> Lexicon {
    let raw = fs::read_to_string(catalog_path()).expect("catalog");
    serde_json::from_str(&raw).expect("parse catalog")
}

impl App {
    fn new() -> (Self, Task<Message>) {
        let lexicon = load();
        let selected = if lexicon.terms.contains_key("home") {
            "home".into()
        } else if lexicon.terms.contains_key("peaking-eq") {
            "peaking-eq".into()
        } else {
            lexicon.terms.keys().next().cloned().unwrap_or_default()
        };
        (
            Self {
                lexicon,
                query: String::new(),
                selected,
            },
            Task::none(),
        )
    }

    fn title(&self) -> String {
        "audio-lexicon (iced)".into()
    }

    fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::Search(q) => self.query = q,
            Message::Select(id) => self.selected = id,
        }
        Task::none()
    }

    fn view(&self) -> Element<'_, Message> {
        let mut tree_col = Column::new().spacing(4);
        let q = self.query.to_lowercase();
        for cat in &self.lexicon.tree {
            if let Some(id) = &cat.term_id {
                if q.is_empty()
                    || cat.label.to_lowercase().contains(&q)
                    || id.to_lowercase().contains(&q)
                {
                    tree_col = tree_col.push(
                        button(text(format!("★ {}", cat.label)).size(14))
                            .on_press(Message::Select(id.clone()))
                            .width(Length::Fill),
                    );
                }
                continue;
            }
            tree_col = tree_col.push(text(&cat.label).size(14));
            if let Some(children) = &cat.children {
                for child in children {
                    if let Some(id) = &child.term_id {
                        if !q.is_empty()
                            && !child.label.to_lowercase().contains(&q)
                            && !id.to_lowercase().contains(&q)
                        {
                            continue;
                        }
                        tree_col = tree_col.push(
                            button(text(&child.label).size(13))
                                .on_press(Message::Select(id.clone()))
                                .width(Length::Fill),
                        );
                    }
                }
            }
        }

        let term = self.lexicon.terms.get(&self.selected);
        let detail: Element<'_, Message> = if let Some(t) = term {
            let is_home = t.id == "home";
            let mut export = if is_home {
                "Project: https://github.com/HCI-Nerdz/audio-lexicon".to_string()
            } else {
                match (&t.exports.equalizer_apo, &t.exports.obs) {
                    (None, None) => "Conceptual only — no EqualizerAPO / OBS map.".to_string(),
                    (apo, obs) => format!(
                        "{}\n{}",
                        apo.as_deref().unwrap_or(""),
                        obs.as_ref()
                            .map(|v| serde_json::to_string_pretty(v).unwrap_or_default())
                            .unwrap_or_default()
                    ),
                }
            };
            if is_home && !t.related_links.is_empty() {
                export.push_str("\n\nRelated projects:\n");
                for link in &t.related_links {
                    export.push_str(&format!("- {} — {}\n", link.label, link.url));
                    if let Some(blurb) = &link.blurb {
                        export.push_str(&format!("  {}\n", blurb));
                    }
                }
            };
            column![
                text(format!("HCI Nerdz · Audio lexicon (iced) · catalog {}", self.lexicon.version)).size(12),
                text(&t.name).size(32),
                text(&t.summary).size(16),
                text(if is_home { format!("Why: {}", t.plain_meaning) } else { format!("Meaning: {}", t.plain_meaning) }),
                text(if is_home { format!("Project: {}", t.history) } else { format!("History: {}", t.history) }),
                text(if is_home { format!("How: {}", t.when_to_use) } else { format!("When: {}", t.when_to_use) }),
                text(if is_home { format!("Not: {}", t.common_confusion) } else { format!("Confusion: {}", t.common_confusion) }),
                text(if is_home { "Links" } else { "Export" }).size(18),
                text(export),
                text(format!("About: audio-lexicon-iced {}", env!("CARGO_PKG_VERSION"))).size(12),
            ]
            .spacing(10)
            .into()
        } else {
            text("Select a term").into()
        };

        let content = row![
            container(
                column![
                    text_input("Search…", &self.query).on_input(Message::Search),
                    scrollable(tree_col).height(Length::Fill),
                ]
                .spacing(8)
            )
            .width(280)
            .padding(12),
            container(scrollable(detail)).padding(16).width(Length::Fill),
        ]
        .height(Length::Fill);

        container(content).width(Length::Fill).height(Length::Fill).into()
    }
}

fn main() -> iced::Result {
    iced::application(App::title, App::update, App::view)
        .window_size((1100.0, 720.0))
        .run_with(App::new)
}
