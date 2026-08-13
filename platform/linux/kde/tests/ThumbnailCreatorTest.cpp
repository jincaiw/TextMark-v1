#include "TextMarkThumbnailCreator.h"

#include <QCoreApplication>
#include <QFile>
#include <QImage>
#include <QSize>
#include <QTemporaryDir>
#include <QUrl>

int main(int argc, char **argv)
{
    QCoreApplication application(argc, argv);
    if (application.arguments().size() != 2) {
        return 2;
    }
    qputenv("TEXTMARK_THUMBNAIL_EXECUTABLE", application.arguments().at(1).toUtf8());
    QTemporaryDir directory;
    if (!directory.isValid()) {
        return 3;
    }
    const QString sourcePath = directory.filePath(QStringLiteral("中文.md"));
    QFile source(sourcePath);
    if (!source.open(QIODevice::WriteOnly) || source.write("# TextMark\n\nKDE 6 native thumbnail.") < 0) {
        return 4;
    }
    source.close();

    TextMarkThumbnailCreator creator(nullptr, {});
    const KIO::ThumbnailRequest request(QUrl::fromLocalFile(sourcePath), QSize(320, 180), QStringLiteral("text/markdown"), 1.0, 0.0f);
    const KIO::ThumbnailResult result = creator.create(request);
    if (!result.isValid() || result.image().isNull() || result.image().width() > 320 || result.image().height() > 180) {
        return 5;
    }
    return 0;
}
