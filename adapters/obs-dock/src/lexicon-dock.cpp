#include "lexicon-dock.hpp"

#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonDocument>
#include <QLabel>
#include <QLineEdit>
#include <QFile>
#include <QDir>
#include <QCoreApplication>
#include <QProcessEnvironment>
#include <QSplitter>
#include <QTextEdit>
#include <QTreeWidget>
#include <QVBoxLayout>
#include <QWidget>

static QString catalogPath() {
  const auto env = QProcessEnvironment::systemEnvironment().value("AUDIO_LEXICON_CATALOG");
  if (!env.isEmpty()) return env;
  return QDir(QCoreApplication::applicationDirPath()).absoluteFilePath("../../catalog/lexicon.json");
}

LexiconDock::LexiconDock(QWidget *parent) : QDockWidget(parent) {
  setObjectName(QStringLiteral("AudioLexiconDock"));
  setWindowTitle(QStringLiteral("Audio Lexicon"));

  auto *root = new QWidget(this);
  auto *lay = new QVBoxLayout(root);
  lay->addWidget(new QLabel(QStringLiteral("HCI Nerdz · out-of-tree dock (not for OBS upstream)")));

  auto *split = new QSplitter(Qt::Horizontal, root);
  auto *side = new QWidget;
  auto *sideLay = new QVBoxLayout(side);
  search_ = new QLineEdit;
  search_->setPlaceholderText(QStringLiteral("Search…"));
  tree_ = new QTreeWidget;
  tree_->setHeaderLabel(QStringLiteral("Terms"));
  sideLay->addWidget(search_);
  sideLay->addWidget(tree_);

  auto *main = new QWidget;
  auto *mainLay = new QVBoxLayout(main);
  title_ = new QLabel(QStringLiteral("Select a term"));
  detail_ = new QTextEdit;
  detail_->setReadOnly(true);
  export_ = new QTextEdit;
  export_->setReadOnly(true);
  mainLay->addWidget(title_);
  mainLay->addWidget(detail_, 1);
  mainLay->addWidget(new QLabel(QStringLiteral("Export")));
  mainLay->addWidget(export_);

  split->addWidget(side);
  split->addWidget(main);
  lay->addWidget(split, 1);
  setWidget(root);

  connect(search_, &QLineEdit::textChanged, this, &LexiconDock::rebuildTree);
  connect(tree_, &QTreeWidget::itemSelectionChanged, this, [this] {
    const auto items = tree_->selectedItems();
    if (items.isEmpty()) return;
    const auto id = items.first()->data(0, Qt::UserRole).toString();
    if (!id.isEmpty()) selectTerm(id);
  });

  loadCatalog();
  rebuildTree(QString());
  if (terms_.contains(QStringLiteral("home"))) selectTerm(QStringLiteral("home"));
}

void LexiconDock::loadCatalog() {
  QFile f(catalogPath());
  if (!f.open(QIODevice::ReadOnly)) return;
  lexicon_ = QJsonDocument::fromJson(f.readAll()).object();
  terms_ = lexicon_.value(QStringLiteral("terms")).toObject();
}

void LexiconDock::rebuildTree(const QString &query) {
  tree_->clear();
  const auto q = query.trimmed().toLower();
  for (const auto &catVal : lexicon_.value(QStringLiteral("tree")).toArray()) {
    const auto cat = catVal.toObject();
    const auto rootTermId = cat.value(QStringLiteral("termId")).toString();
    if (!rootTermId.isEmpty()) {
      const auto label = cat.value(QStringLiteral("label")).toString();
      if (!q.isEmpty() && !label.toLower().contains(q) && !rootTermId.toLower().contains(q)) continue;
      auto *item = new QTreeWidgetItem(tree_, QStringList{label});
      item->setData(0, Qt::UserRole, rootTermId);
      continue;
    }
    auto *parent = new QTreeWidgetItem(tree_, QStringList{cat.value(QStringLiteral("label")).toString()});
    for (const auto &childVal : cat.value(QStringLiteral("children")).toArray()) {
      const auto child = childVal.toObject();
      const auto id = child.value(QStringLiteral("termId")).toString();
      const auto label = child.value(QStringLiteral("label")).toString();
      if (!q.isEmpty() && !label.toLower().contains(q) && !id.toLower().contains(q)) continue;
      auto *item = new QTreeWidgetItem(parent, QStringList{label});
      item->setData(0, Qt::UserRole, id);
    }
  }
  tree_->expandAll();
}

void LexiconDock::selectTerm(const QString &id) {
  const auto term = terms_.value(id).toObject();
  title_->setText(term.value(QStringLiteral("name")).toString());
  QString detail = QStringLiteral("Summary: %1\n\nMeaning: %2\n\nHistory: %3\n\nWhen: %4\n\nConfusion: %5")
                       .arg(term.value(QStringLiteral("summary")).toString(),
                            term.value(QStringLiteral("plainMeaning")).toString(),
                            term.value(QStringLiteral("history")).toString(),
                            term.value(QStringLiteral("whenToUse")).toString(),
                            term.value(QStringLiteral("commonConfusion")).toString());
  const auto related = term.value(QStringLiteral("relatedLinks")).toArray();
  if (!related.isEmpty()) {
    detail += QStringLiteral("\n\nRelated projects:\n");
    for (const auto &linkVal : related) {
      const auto link = linkVal.toObject();
      detail += QStringLiteral("- %1 — %2")
                    .arg(link.value(QStringLiteral("label")).toString(),
                         link.value(QStringLiteral("url")).toString());
      const auto blurb = link.value(QStringLiteral("blurb")).toString();
      if (!blurb.isEmpty()) detail += QStringLiteral("\n  %1").arg(blurb);
      detail += QLatin1Char('\n');
    }
  }
  detail_->setPlainText(detail);
  const auto ex = term.value(QStringLiteral("exports")).toObject();
  QString out;
  if (ex.contains(QStringLiteral("equalizerApo")))
    out += QStringLiteral("# EqualizerAPO\n") + ex.value(QStringLiteral("equalizerApo")).toString() + QStringLiteral("\n\n");
  if (ex.contains(QStringLiteral("obs")))
    out += QStringLiteral("# OBS\n") + QString::fromUtf8(QJsonDocument(ex.value(QStringLiteral("obs")).toObject()).toJson(QJsonDocument::Indented));
  if (out.isEmpty()) out = QStringLiteral("Conceptual only");
  export_->setPlainText(out);
}
