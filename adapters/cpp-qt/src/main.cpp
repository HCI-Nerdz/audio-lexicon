#include "MainWindow.hpp"
#include <QApplication>

int main(int argc, char *argv[]) {
  QApplication app(argc, argv);
  QApplication::setApplicationName(QStringLiteral("audio-lexicon"));
  QApplication::setApplicationVersion(QStringLiteral(APP_VERSION));
  QApplication::setOrganizationName(QStringLiteral("HCI Nerdz"));
  MainWindow w;
  w.show();
  return app.exec();
}
