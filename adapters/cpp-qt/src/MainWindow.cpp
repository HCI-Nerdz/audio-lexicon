#include "MainWindow.hpp"

#include <QApplication>
#include <QFile>
#include <QHash>
#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonDocument>
#include <QLabel>
#include <QLineEdit>
#include <QMenuBar>
#include <QMessageBox>
#include <QProcessEnvironment>
#include <QSlider>
#include <QSplitter>
#include <QTextEdit>
#include <QTreeWidget>
#include <QVBoxLayout>
#include <QWidget>
#include <QCoreApplication>
#include <QDir>

static QString catalogPath() {
  const auto env = QProcessEnvironment::systemEnvironment().value("AUDIO_LEXICON_CATALOG");
  if (!env.isEmpty()) return env;
  return QDir(QCoreApplication::applicationDirPath()).absoluteFilePath("../../catalog/lexicon.json");
}

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
  setWindowTitle(QStringLiteral("audio-lexicon (Qt)"));
  resize(1100, 720);

  auto *central = new QWidget(this);
  auto *root = new QVBoxLayout(central);
  root->addWidget(new QLabel(QStringLiteral("HCI Nerdz · Audio lexicon (C++/Qt)")));

  auto *split = new QSplitter(Qt::Horizontal, central);
  auto *side = new QWidget;
  auto *sideLay = new QVBoxLayout(side);
  search_ = new QLineEdit;
  search_->setPlaceholderText(QStringLiteral("Search terms…"));
  tree_ = new QTreeWidget;
  tree_->setHeaderLabel(QStringLiteral("Terms"));
  sideLay->addWidget(search_);
  sideLay->addWidget(tree_);

  auto *main = new QWidget;
  auto *mainLay = new QVBoxLayout(main);
  title_ = new QLabel(QStringLiteral("Select a term"));
  QFont f = title_->font();
  f.setPointSize(22);
  f.setBold(true);
  title_->setFont(f);
  detail_ = new QTextEdit;
  detail_->setReadOnly(true);
  controls_ = new QVBoxLayout;
  export_ = new QTextEdit;
  export_->setReadOnly(true);
  mainLay->addWidget(title_);
  mainLay->addWidget(detail_, 1);
  mainLay->addLayout(controls_);
  mainLay->addWidget(new QLabel(QStringLiteral("Export")));
  mainLay->addWidget(export_);

  split->addWidget(side);
  split->addWidget(main);
  split->setStretchFactor(1, 1);
  root->addWidget(split, 1);
  setCentralWidget(central);

  auto *about = menuBar()->addMenu(QStringLiteral("Help"));
  about->addAction(QStringLiteral("About"), this, [this] {
    QMessageBox::about(this, QStringLiteral("About"),
                       QStringLiteral("audio-lexicon %1\nEqualizerAPO-aligned Qt adapter\nCatalog %2")
                           .arg(QStringLiteral(APP_VERSION))
                           .arg(lexicon_.value(QStringLiteral("version")).toString()));
  });

  connect(search_, &QLineEdit::textChanged, this, &MainWindow::rebuildTree);
  connect(tree_, &QTreeWidget::itemSelectionChanged, this, [this] {
    const auto items = tree_->selectedItems();
    if (items.isEmpty()) return;
    const auto id = items.first()->data(0, Qt::UserRole).toString();
    if (!id.isEmpty()) selectTerm(id);
  });

  loadCatalog();
  rebuildTree(QString());
  if (terms_.contains(QStringLiteral("home"))) selectTerm(QStringLiteral("home"));
  else if (terms_.contains(QStringLiteral("peaking-eq"))) selectTerm(QStringLiteral("peaking-eq"));
}

void MainWindow::loadCatalog() {
  QFile f(catalogPath());
  if (!f.open(QIODevice::ReadOnly)) {
    QMessageBox::critical(this, QStringLiteral("Catalog"), QStringLiteral("Missing lexicon.json"));
    return;
  }
  lexicon_ = QJsonDocument::fromJson(f.readAll()).object();
  terms_ = lexicon_.value(QStringLiteral("terms")).toObject();
}

void MainWindow::rebuildTree(const QString &query) {
  tree_->clear();
  const auto q = query.trimmed().toLower();
  const auto tree = lexicon_.value(QStringLiteral("tree")).toArray();
  for (const auto &catVal : tree) {
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

void MainWindow::selectTerm(const QString &id) {
  selectedId_ = id;
  const auto term = terms_.value(id).toObject();
  title_->setText(term.value(QStringLiteral("name")).toString());
  detail_->setPlainText(
      QStringLiteral("Summary: %1\n\nMeaning: %2\n\nHistory: %3\n\nWhen: %4\n\nConfusion: %5")
          .arg(term.value(QStringLiteral("summary")).toString(),
               term.value(QStringLiteral("plainMeaning")).toString(),
               term.value(QStringLiteral("history")).toString(),
               term.value(QStringLiteral("whenToUse")).toString(),
               term.value(QStringLiteral("commonConfusion")).toString()));

  while (QLayoutItem *child = controls_->takeAt(0)) {
    delete child->widget();
    delete child;
  }
  params_.clear();
  for (const auto &pVal : term.value(QStringLiteral("parameters")).toArray()) {
    const auto p = pVal.toObject();
    const auto kind = p.value(QStringLiteral("kind")).toString();
    if (kind != QLatin1String("float") && kind != QLatin1String("int")) continue;
    const auto pid = p.value(QStringLiteral("id")).toString();
    const double def = p.value(QStringLiteral("default")).toDouble();
    const double minv = p.value(QStringLiteral("min")).toDouble();
    const double maxv = p.value(QStringLiteral("max")).toDouble();
    params_[pid] = def;
    auto *row = new QWidget;
    auto *lay = new QHBoxLayout(row);
    lay->addWidget(new QLabel(p.value(QStringLiteral("label")).toString()));
    auto *slider = new QSlider(Qt::Horizontal);
    slider->setRange(0, 1000);
    slider->setValue(int((def - minv) / (maxv - minv) * 1000.0));
    auto *valLbl = new QLabel(QString::number(def));
    lay->addWidget(slider, 1);
    lay->addWidget(valLbl);
    connect(slider, &QSlider::valueChanged, this, [this, pid, minv, maxv, valLbl](int v) {
      const double x = minv + (maxv - minv) * (v / 1000.0);
      params_[pid] = x;
      valLbl->setText(QString::number(x, 'f', 2));
      refreshExport();
    });
    controls_->addWidget(row);
  }
  refreshExport();
}

QString MainWindow::fillTemplate(QString tmpl) const {
  for (auto it = params_.cbegin(); it != params_.cend(); ++it)
    tmpl.replace(QStringLiteral("{%1}").arg(it.key()), QString::number(it.value()));
  return tmpl;
}

void MainWindow::refreshExport() {
  const auto term = terms_.value(selectedId_).toObject();
  const auto ex = term.value(QStringLiteral("exports")).toObject();
  QString out;
  if (ex.contains(QStringLiteral("equalizerApo")))
    out += QStringLiteral("# EqualizerAPO\n") + fillTemplate(ex.value(QStringLiteral("equalizerApo")).toString()) + QStringLiteral("\n\n");
  if (ex.contains(QStringLiteral("obs")))
    out += QStringLiteral("# OBS\n") + QString::fromUtf8(QJsonDocument(ex.value(QStringLiteral("obs")).toObject()).toJson(QJsonDocument::Indented));
  if (out.isEmpty()) out = QStringLiteral("Conceptual only — no EqualizerAPO / OBS map.");
  export_->setPlainText(out);
}
