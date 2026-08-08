#pragma once
#include <QDockWidget>
#include <QJsonObject>

class QTreeWidget;
class QLabel;
class QTextEdit;
class QLineEdit;

class LexiconDock : public QDockWidget {
  Q_OBJECT
public:
  explicit LexiconDock(QWidget *parent = nullptr);

private:
  void loadCatalog();
  void rebuildTree(const QString &query);
  void selectTerm(const QString &id);

  QJsonObject lexicon_;
  QJsonObject terms_;
  QTreeWidget *tree_ = nullptr;
  QLabel *title_ = nullptr;
  QTextEdit *detail_ = nullptr;
  QTextEdit *export_ = nullptr;
  QLineEdit *search_ = nullptr;
};
