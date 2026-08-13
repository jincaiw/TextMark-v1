#include <QCoreApplication>
#include <QColor>
#include <QImage>

int main(int argc, char **argv)
{
    QCoreApplication application(argc, argv);
    const QStringList arguments = application.arguments();
    if (arguments.size() != 5 || arguments.at(1) != QStringLiteral("--thumbnail")) {
        return 2;
    }
    bool valid = false;
    const int size = arguments.at(4).toInt(&valid);
    if (!valid || size < 128 || size > 1024) {
        return 3;
    }
    QImage image(size, size, QImage::Format_RGB32);
    image.fill(QColor(QStringLiteral("#ffffff")));
    return image.save(arguments.at(3), "PNG") ? 0 : 4;
}
