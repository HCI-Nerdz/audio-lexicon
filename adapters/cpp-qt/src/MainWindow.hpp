#pragma once
#include <QMainWindow>
#include <QJsonObject>

class QTreeWidget;
class QLabel;
class QTextEdit;
class QVBoxLayout;
class QLineEdit;

class MainWindow : public QMainWindow {
  Q_OBJECT
public:
  explicit MainWindow(QWidget *parent = nullptr);

private:
  void loadCatalog();
  void rebuildTree(const QString &query);
  void selectTerm(const QString &id);
  void refreshExport();
  QString fillTemplate(QString tmpl) const;

  QJsonObject lexicon_;
  QJsonObject terms_;
  QTreeWidget *tree_ = nullptr;
  QLabel *title_ = nullptr;
  QTextEdit *detail_ = nullptr;
  QTextEdit *export_ = nullptr;
  QVBoxLayout *controls_ = nullptr;
  QLineEdit *search_ = nullptr;
  QString selectedId_;
  QHash<QString, double> params_;
};
